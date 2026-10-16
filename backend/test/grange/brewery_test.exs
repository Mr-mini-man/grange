defmodule Grange.BreweryTest do
  @moduledoc false
  use ExUnit.Case, async: true

  alias Grange.{Brewery, Crops, Inventory}

  test "every potion recipe uses known crops with positive counts" do
    for id <- Brewery.potion_ids(), {crop, count} <- Brewery.potion(id).recipe do
      assert Crops.known?(crop)
      assert count > 0
    end
  end

  test "can_brew? requires every ingredient in the recipe" do
    inv = Inventory.default()
    refute Brewery.can_brew?(inv, "greenThumb")
    assert Brewery.can_brew?(inv, "unknown") == false

    stocked = inv |> Inventory.add("wheat", 2) |> Inventory.add("potato", 1)
    assert Brewery.can_brew?(stocked, "greenThumb")
  end

  test "can_build? requires the full material and coin cost" do
    cost = Brewery.brewery_cost()
    inv = Map.put(Inventory.default(), "coins", 0)
    refute Brewery.can_build?(inv)

    stocked =
      inv
      |> Inventory.add("wood", cost["wood"])
      |> Inventory.add("stone", cost["stone"])

    refute Brewery.can_build?(stocked)
    assert Brewery.can_build?(Inventory.add(stocked, "coins", cost["coins"]))
  end

  test "growth and harvest scale while their effects run" do
    now = 1_000
    effects = %{"growth" => now + 100, "luck" => now + 100, "speed" => now + 100}

    assert Brewery.growth_ms("wheat", effects, now) ==
             round(Crops.grow_ms("wheat") * 0.5)

    assert Brewery.harvest_yield("barley", effects, now) ==
             Crops.yield_of("barley") + 2

    assert Brewery.move_speed_multiplier(effects, now) > 1.0
  end

  test "lapsed effects stop applying and are pruned" do
    now = 1_000
    effects = %{"growth" => now - 1, "luck" => now + 100}

    refute Brewery.active_effect?(effects, "growth", now)
    assert Brewery.active_effect?(effects, "luck", now)
    assert Brewery.prune_effects(effects, now) == %{"luck" => now + 100}
    assert Brewery.move_speed_multiplier(effects, now) == 1.0
  end
end
