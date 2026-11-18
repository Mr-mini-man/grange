defmodule Grange.BankLandTest do
  @moduledoc false
  use ExUnit.Case, async: false

  alias Grange.{Accounts, Bank, BankInterest, FarmStore, Land, Repo, User}

  setup do
    Accounts.reset()
    FarmStore.reset()

    {:ok, user} =
      Accounts.register(%{
        "username" => "LandBuyer",
        "email" => "land@example.test",
        "password" => "harvest-please"
      })

    FarmStore.ensure(user.username)
    %{user: user}
  end

  test "savings transfers are persisted and never overdrawn", %{user: user} do
    assert {:ok, %{balance: 60, bank_balance: 40}} = Bank.transfer(user.id, "deposit", 40)
    assert {:error, "insufficient wallet funds"} = Bank.transfer(user.id, "deposit", 61)
    assert {:error, "insufficient savings"} = Bank.transfer(user.id, "withdraw", 41)
    assert {:ok, %{balance: 75, bank_balance: 25}} = Bank.transfer(user.id, "withdraw", 15)
    assert {:error, "enter a positive whole amount"} = Bank.transfer(user.id, "deposit", -1)
    stored = Accounts.find_by_id(user.id)
    assert stored.balance == 75
    assert stored.bank_balance == 25
  end

  test "starter farm stays usable and purchases expand beyond its edge", %{user: user} do
    assert FarmStore.view(user.username).land_level == 0

    assert {:ok, _farm} =
             FarmStore.action(user.username, %{"kind" => "till", "x" => 7, "y" => 2})

    assert {:error, "buy this land from the mayor first"} =
             FarmStore.action(user.username, %{"kind" => "till", "x" => 7, "y" => -1})

    assert {:ok, _} = Accounts.apply_balance_delta(user.id, 200)
    assert {:ok, %{balance: 50, land_level: 1}} = Land.buy(user.id, user.username)

    assert {:ok, _farm} =
             FarmStore.action(user.username, %{"kind" => "till", "x" => 7, "y" => -1})

    assert {:error, "insufficient wallet funds"} = Land.buy(user.id, user.username)
    assert FarmStore.view(user.username).land_level == 1
  end

  test "the final parcel reaches the full walkable map border", %{user: user} do
    assert {:ok, _} = Accounts.apply_balance_delta(user.id, 10_000)

    for _ <- 1..5 do
      assert {:ok, _} = Land.buy(user.id, user.username)
    end

    assert FarmStore.view(user.username).land_level == 5
    assert Land.bounds(5) == %{min_x: -6, max_x: 24, min_y: -4}

    assert {:ok, _} =
             FarmStore.action(user.username, %{"kind" => "till", "x" => -6, "y" => -4})

    assert {:ok, _} =
             FarmStore.action(user.username, %{"kind" => "till", "x" => 24, "y" => 9})

    assert {:error, "out of bounds"} =
             FarmStore.action(user.username, %{"kind" => "till", "x" => 25, "y" => 9})

    # Fence corners run one tile past the last owned column.
    assert {:ok, _} =
             FarmStore.action(user.username, %{"kind" => "place_fence", "x" => 25, "y" => 10})
  end

  test "one farm cannot buy land for another", %{user: user} do
    FarmStore.ensure("Other")
    assert {:error, "not your farm"} = Land.buy(user.id, "Other")
  end

  test "savings accrue tiered interest once a whole day has passed", %{user: user} do
    assert {:ok, _} = Accounts.apply_balance_delta(user.id, 1_000)

    assert {:ok, %{bank_balance: 1_000, interest_rate: 4}} =
             Bank.transfer(user.id, "deposit", 1_000)

    backdate(user.id, BankInterest.day_ms())

    assert {:ok, view} = Bank.view(user.id)
    assert view.bank_balance == 1_040
    assert view.interest_rate == 4
    assert view.next_tier == %{min_balance: 2_000, rate: 7}

    # The accrued interest is persisted, not just returned.
    assert Repo.get(User, user.id).bank_balance == 1_040
  end

  defp backdate(user_id, ms) do
    user = Repo.get(User, user_id)
    Repo.update!(Ecto.Changeset.change(user, bank_interest_at: user.bank_interest_at - ms))
  end
end
