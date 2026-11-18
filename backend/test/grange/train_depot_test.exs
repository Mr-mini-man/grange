defmodule Grange.TrainDepotTest do
  @moduledoc false
  use ExUnit.Case, async: false

  alias Grange.{Accounts, FarmStore, Repo, TrainDepot}

  setup do
    FarmStore.reset()
    Accounts.reset()
    :ok
  end

  defp user(username, balance \\ 100) do
    {:ok, user} =
      Accounts.register(%{
        "username" => username,
        "email" => "#{username}@example.test",
        "password" => "harvest-please"
      })

    FarmStore.ensure(username)

    user
    |> Ecto.Changeset.change(balance: balance)
    |> Repo.update!()
    |> Map.put(:balance, balance)
  end

  test "buying an engine upgrade debits the wallet and levels the train" do
    buyer = user("Engineer", 1_000)
    assert TrainDepot.price("train-engine") == 400

    assert {:ok, result} = TrainDepot.buy(buyer, "train-engine")
    assert result.balance == 600
    assert FarmStore.view("Engineer").train.engine == 1
  end

  test "adding a cart and upgrading a cart raise the train" do
    buyer = user("Coupler", 1_000)

    # A starter engine pulls only one cart, so the engine comes first.
    assert {:ok, _} = TrainDepot.buy(buyer, "train-engine")
    assert {:ok, _} = TrainDepot.buy(buyer, "train-cart")
    assert length(FarmStore.view("Coupler").train.carts) == 2

    assert {:ok, _} = TrainDepot.buy(buyer, "train-cart-upgrade")
    assert hd(FarmStore.view("Coupler").train.carts).tier == 2
  end

  test "a purchase is rejected when the wallet is short" do
    buyer = user("Broke", 50)
    assert {:error, "insufficient funds"} = TrainDepot.buy(buyer, "train-cart")
    assert FarmStore.view("Broke").train.carts |> length() == 1
  end

  test "an engine at the cap rejects further upgrades" do
    buyer = user("Maxed", 10_000)
    Enum.each(1..3, fn _ -> assert {:ok, _} = TrainDepot.buy(buyer, "train-engine") end)

    assert {:error, "the engine is already fully upgraded"} =
             TrainDepot.buy(buyer, "train-engine")
  end

  test "unknown items are rejected" do
    buyer = user("Shopper")
    assert {:error, "unknown item"} = TrainDepot.buy(buyer, "train-rocket")
  end
end
