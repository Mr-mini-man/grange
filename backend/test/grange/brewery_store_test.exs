defmodule Grange.BreweryStoreTest do
  @moduledoc false
  use ExUnit.Case, async: false

  alias Grange.{Brewery, BreweryStore, Crops, FarmStore}

  setup do
    FarmStore.reset()
    :ok
  end

  defp stock(owner, crop, x, y) do
    FarmStore.action(owner, %{"kind" => "till", "x" => x, "y" => y})
    FarmStore.action(owner, %{"kind" => "plant", "x" => x, "y" => y, "crop" => crop})
    FarmStore.action(owner, %{"kind" => "water", "x" => x, "y" => y})
    FarmStore.tick(System.system_time(:millisecond) + 60_000)
    FarmStore.action(owner, %{"kind" => "harvest", "x" => x, "y" => y})
  end

  defp build(owner) do
    cost = Brewery.brewery_cost()
    {:ok, _} = BreweryStore.buy_material(owner, "wood", cost["wood"])
    {:ok, _} = BreweryStore.buy_material(owner, "stone", cost["stone"])
    {:ok, view} = BreweryStore.build_brewery(owner)
    view
  end

  test "buying a seed spends coins and adds seeds" do
    FarmStore.ensure("Alice")

    assert {:ok, view} = BreweryStore.buy_seed("Alice", "wheat", 2)
    assert view.inventory["wheatSeed"] == 2
    assert view.inventory["coins"] == 100 - Crops.get("wheat").seed_price * 2
  end

  test "malformed quantities and unknown items are rejected" do
    FarmStore.ensure("Alice")

    assert {:error, "invalid quantity"} = BreweryStore.buy_seed("Alice", "wheat", 0)
    assert {:error, "invalid quantity"} = BreweryStore.buy_seed("Alice", "wheat", -3)
    assert {:error, "invalid quantity"} = BreweryStore.buy_seed("Alice", "wheat", 1.5)
    assert {:error, "invalid quantity"} = BreweryStore.buy_seed("Alice", "wheat", 100_000)
    assert {:error, "unknown seed"} = BreweryStore.buy_seed("Alice", "corn", 1)
    assert {:error, "unknown material"} = BreweryStore.buy_material("Alice", "gold", 1)
  end

  test "a purchase the purse cannot cover is rejected" do
    FarmStore.ensure("Alice")

    assert {:error, "not enough coins"} = BreweryStore.buy_material("Alice", "wood", 1_000)
  end

  test "the brewery can only be built once" do
    FarmStore.ensure("Alice")

    assert %{brewery: %{built: true}} = build("Alice")
    assert {:error, "brewery already built"} = BreweryStore.build_brewery("Alice")
  end

  test "brewing consumes the recipe's crops into a potion" do
    FarmStore.ensure("Alice")
    build("Alice")
    stock("Alice", "wheat", 0, 0)
    stock("Alice", "potato", 1, 0)

    assert {:ok, view} = BreweryStore.brew("Alice", "greenThumb")
    assert view.inventory["potions"]["greenThumb"] == 1
    assert view.inventory["wheat"] == Crops.yield_of("wheat") - 2
    assert view.inventory["potato"] == Crops.yield_of("potato") - 1
  end

  test "brewing without a brewery or ingredients fails" do
    FarmStore.ensure("Alice")

    assert {:error, "build a brewery first"} = BreweryStore.brew("Alice", "greenThumb")

    build("Alice")
    assert {:error, "missing crops"} = BreweryStore.brew("Alice", "greenThumb")
  end

  test "drinking a potion spends it and starts its effect" do
    FarmStore.ensure("Alice")
    build("Alice")
    stock("Alice", "wheat", 0, 0)
    stock("Alice", "potato", 1, 0)
    BreweryStore.brew("Alice", "greenThumb")

    assert {:ok, view} = BreweryStore.use_potion("Alice", "greenThumb")
    assert view.inventory["potions"]["greenThumb"] == 0
    assert [%{kind: "growth", expiresAt: expires}] = view.brewery.effects
    assert expires > System.system_time(:millisecond)
  end

  test "the bar buys potions and crops for coins" do
    FarmStore.ensure("Alice")
    build("Alice")
    stock("Alice", "wheat", 0, 0)
    stock("Alice", "potato", 1, 0)
    BreweryStore.brew("Alice", "greenThumb")

    before = FarmStore.view("Alice").inventory["coins"]

    assert {:ok, view} = BreweryStore.sell_potion("Alice", "greenThumb")
    assert view.inventory["coins"] == before + Brewery.potion("greenThumb").bar_price

    coins = view.inventory["coins"]
    assert {:ok, sold} = BreweryStore.sell_crop("Alice", "wheat")
    assert sold.inventory["coins"] == coins + Crops.get("wheat").crop_price
  end

  test "selling what you do not have fails" do
    FarmStore.ensure("Alice")

    assert {:error, "no potion to sell"} = BreweryStore.sell_potion("Alice", "greenThumb")
    assert {:error, "no crop to sell"} = BreweryStore.sell_crop("Alice", "wheat")
    assert {:error, "unknown potion"} = BreweryStore.sell_potion("Alice", "sludge")
    assert {:error, "unknown crop"} = BreweryStore.sell_crop("Alice", "corn")
  end
end
