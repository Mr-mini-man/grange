defmodule Grange.FarmTrainTest do
  @moduledoc false
  use ExUnit.Case, async: false

  import Grange.FarmFixtures

  alias Grange.{FarmStore, FarmTrain}

  setup do
    reset_farm_state()
    :ok
  end

  defp train(owner), do: FarmStore.view(owner).train

  test "a fresh farm has a starter engine and one two-slot cart" do
    FarmStore.ensure("Alice")
    %{engine: 0, max_carts: 1, carts: [cart]} = train("Alice")
    assert cart.tier == 1
    assert cart.capacity == 2
    assert cart.cargo == %{}
  end

  test "upgrading the engine speeds it up and unlocks more carts" do
    FarmStore.ensure("Alice")
    assert {:ok, :ok} = FarmTrain.upgrade_engine("Alice")
    assert train("Alice").engine == 1
    assert train("Alice").max_carts == 2
    assert {:ok, :ok} = FarmTrain.add_cart("Alice")
    assert length(train("Alice").carts) == 2
  end

  test "the engine caps out and carts need engine room" do
    FarmStore.ensure("Alice")
    Enum.each(1..3, fn _ -> assert {:ok, :ok} = FarmTrain.upgrade_engine("Alice") end)
    assert {:error, "the engine is already fully upgraded"} = FarmTrain.upgrade_engine("Alice")

    Enum.each(1..3, fn _ -> assert {:ok, :ok} = FarmTrain.add_cart("Alice") end)
    assert {:error, "upgrade the engine to pull more carts"} = FarmTrain.add_cart("Alice")
  end

  test "cart upgrades raise the smallest cart, up to the cap" do
    FarmStore.ensure("Alice")
    assert {:ok, :ok} = FarmTrain.upgrade_cart("Alice")
    assert hd(train("Alice").carts).tier == 2
    assert {:ok, :ok} = FarmTrain.upgrade_cart("Alice")
    assert hd(train("Alice").carts).tier == 3
    assert {:error, "every cart is already fully upgraded"} = FarmTrain.upgrade_cart("Alice")
  end

  test "deposits fill the first cart and respect its capacity" do
    FarmStore.ensure("Alice")

    assert {:ok, :ok} =
             FarmTrain.action("Alice", %{"kind" => "deposit", "item" => "wheat", "count" => 5})

    assert hd(train("Alice").carts).cargo == %{"wheat" => 5}

    # A second distinct item uses the cart's other slot...
    assert {:ok, :ok} =
             FarmTrain.action("Alice", %{"kind" => "deposit", "item" => "lettuce", "count" => 2})

    # ...and a third has nowhere to go in a two-slot cart.
    assert {:error, "the train is full"} =
             FarmTrain.action("Alice", %{"kind" => "deposit", "item" => "tomato", "count" => 1})

    # More of a stacked item tops it up.
    assert {:ok, :ok} =
             FarmTrain.action("Alice", %{"kind" => "deposit", "item" => "wheat", "count" => 10})

    assert hd(train("Alice").carts).cargo["wheat"] == 15
  end

  test "withdrawals take from a specific cart" do
    FarmStore.ensure("Alice")
    FarmTrain.action("Alice", %{"kind" => "deposit", "item" => "wheat", "count" => 4})

    assert {:ok, :ok} =
             FarmTrain.action("Alice", %{
               "kind" => "withdraw",
               "item" => "wheat",
               "count" => 1,
               "cart" => 1
             })

    assert hd(train("Alice").carts).cargo["wheat"] == 3

    assert {:error, "not enough in the cart"} =
             FarmTrain.action("Alice", %{
               "kind" => "withdraw",
               "item" => "wheat",
               "count" => 9,
               "cart" => 1
             })

    assert {:error, "no such cart"} =
             FarmTrain.action("Alice", %{
               "kind" => "withdraw",
               "item" => "wheat",
               "count" => 1,
               "cart" => 9
             })
  end

  test "invalid cargo actions are rejected" do
    FarmStore.ensure("Alice")

    assert {:error, "invalid item"} =
             FarmTrain.action("Alice", %{
               "kind" => "deposit",
               "item" => "Not An Item",
               "count" => 1
             })

    assert {:error, "invalid count"} =
             FarmTrain.action("Alice", %{"kind" => "deposit", "item" => "wheat", "count" => 0})

    assert {:error, "invalid train action"} = FarmTrain.action("Alice", %{"kind" => "eat"})
  end
end
