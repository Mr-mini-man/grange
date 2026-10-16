defmodule Grange.FarmStoreTest do
  @moduledoc false
  use ExUnit.Case, async: false

  alias Grange.{Crops, Farm, FarmStore}

  setup do
    FarmStore.reset()
    :ok
  end

  defp tile_at(owner, x, y) do
    FarmStore.view(owner).tiles |> Enum.find(&(&1.x == x and &1.y == y))
  end

  test "ensure/1 creates a farm once" do
    refute FarmStore.has_farm?("Alice")

    view = FarmStore.ensure("Alice")
    assert view.owner == "Alice"
    assert view.tiles == []
    assert view.tomatoes == 0
    assert FarmStore.has_farm?("Alice")
    assert FarmStore.ensure("Alice") == view
  end

  test "tilling creates a tile and rejects a double till" do
    FarmStore.ensure("Alice")

    assert {:ok, _view} = FarmStore.action("Alice", %{"kind" => "till", "x" => 2, "y" => 3})
    assert %{state: :tilled} = tile_at("Alice", 2, 3)

    assert {:error, "tile is already tilled"} =
             FarmStore.action("Alice", %{"kind" => "till", "x" => 2, "y" => 3})
  end

  test "plant and water follow the tile lifecycle" do
    FarmStore.ensure("Alice")

    assert {:error, "no tilled tile here"} =
             FarmStore.action("Alice", %{"kind" => "plant", "x" => 0, "y" => 0})

    FarmStore.action("Alice", %{"kind" => "till", "x" => 0, "y" => 0})
    assert {:ok, _} = FarmStore.action("Alice", %{"kind" => "plant", "x" => 0, "y" => 0})
    assert %{state: :planted} = tile_at("Alice", 0, 0)

    assert {:ok, _} = FarmStore.action("Alice", %{"kind" => "water", "x" => 0, "y" => 0})
    assert %{state: :watered} = tile_at("Alice", 0, 0)
  end

  test "watering rejects untilled and already-watered tiles; unknown kinds are invalid" do
    FarmStore.ensure("Alice")
    FarmStore.action("Alice", %{"kind" => "till", "x" => 1, "y" => 1})

    assert {:error, "tile is not planted"} =
             FarmStore.action("Alice", %{"kind" => "water", "x" => 1, "y" => 1})

    FarmStore.action("Alice", %{"kind" => "plant", "x" => 1, "y" => 1})
    assert {:ok, _} = FarmStore.action("Alice", %{"kind" => "water", "x" => 1, "y" => 1})

    assert {:error, "tile is not planted"} =
             FarmStore.action("Alice", %{"kind" => "water", "x" => 1, "y" => 1})

    assert {:error, "invalid action"} =
             FarmStore.action("Alice", %{"kind" => "dance", "x" => 1, "y" => 1})
  end

  test "tick marks watered tiles ready and harvest yields tomatoes" do
    FarmStore.ensure("Alice")
    FarmStore.action("Alice", %{"kind" => "till", "x" => 5, "y" => 5})
    FarmStore.action("Alice", %{"kind" => "plant", "x" => 5, "y" => 5})
    FarmStore.action("Alice", %{"kind" => "water", "x" => 5, "y" => 5})

    future = System.system_time(:millisecond) + Farm.grow_ms() + 60_000
    assert ["Alice"] = FarmStore.tick(future)
    assert %{state: :ready} = tile_at("Alice", 5, 5)

    assert {:ok, view} = FarmStore.action("Alice", %{"kind" => "harvest", "x" => 5, "y" => 5})
    assert view.tomatoes == Farm.harvest_yield()
    assert %{state: :tilled} = tile_at("Alice", 5, 5)
  end

  test "selling tomatoes removes them from the barn" do
    FarmStore.ensure("Alice")
    FarmStore.action("Alice", %{"kind" => "till", "x" => 0, "y" => 0})
    FarmStore.action("Alice", %{"kind" => "plant", "x" => 0, "y" => 0})
    FarmStore.action("Alice", %{"kind" => "water", "x" => 0, "y" => 0})

    future = System.system_time(:millisecond) + Farm.grow_ms() + 60_000
    FarmStore.tick(future)
    FarmStore.action("Alice", %{"kind" => "harvest", "x" => 0, "y" => 0})

    assert {:ok, view} = FarmStore.sell_tomatoes("Alice", 2)
    assert view.tomatoes == Farm.harvest_yield() - 2
  end

  test "selling more tomatoes than the barn holds is rejected" do
    FarmStore.ensure("Alice")

    assert {:error, "not enough tomatoes"} = FarmStore.sell_tomatoes("Alice", 1)
  end

  test "selling a non-positive amount is rejected" do
    FarmStore.ensure("Alice")

    assert {:error, "invalid count"} = FarmStore.sell_tomatoes("Alice", 0)
    assert {:error, "invalid count"} = FarmStore.sell_tomatoes("Alice", -2)
  end

  test "actions outside the grid are rejected" do
    FarmStore.ensure("Alice")

    assert {:error, "out of bounds"} =
             FarmStore.action("Alice", %{"kind" => "till", "x" => 99, "y" => 0})
  end

  test "summaries report tile counts and tomatoes" do
    FarmStore.ensure("Alice")
    FarmStore.action("Alice", %{"kind" => "till", "x" => 0, "y" => 0})
    FarmStore.action("Alice", %{"kind" => "plant", "x" => 0, "y" => 0})

    assert [%{owner: "Alice", tiles: 1, planted: 1, tomatoes: 0}] = FarmStore.summaries()
  end

  test "tick broadcasts a single lobby summary no matter how many farms change" do
    for owner <- ["Alice", "Bob", "Carol"] do
      FarmStore.ensure(owner)
      FarmStore.action(owner, %{"kind" => "till", "x" => 0, "y" => 0})
      FarmStore.action(owner, %{"kind" => "plant", "x" => 0, "y" => 0})
      FarmStore.action(owner, %{"kind" => "water", "x" => 0, "y" => 0})
    end

    GrangeWeb.Endpoint.subscribe("lobby")

    future = System.system_time(:millisecond) + Farm.grow_ms() + 60_000
    assert Enum.sort(FarmStore.tick(future)) == ["Alice", "Bob", "Carol"]

    assert_receive %Phoenix.Socket.Broadcast{event: "farms"}
    refute_receive %Phoenix.Socket.Broadcast{event: "farms"}, 50
  end

  test "planting a named crop records it and harvest adds that crop" do
    FarmStore.ensure("Alice")
    FarmStore.action("Alice", %{"kind" => "till", "x" => 2, "y" => 2})
    FarmStore.action("Alice", %{"kind" => "plant", "x" => 2, "y" => 2, "crop" => "wheat"})

    assert %{crop: "wheat", cropId: "wheat"} = tile_at("Alice", 2, 2)

    FarmStore.action("Alice", %{"kind" => "water", "x" => 2, "y" => 2})
    FarmStore.tick(System.system_time(:millisecond) + 60_000)

    assert {:ok, view} = FarmStore.action("Alice", %{"kind" => "harvest", "x" => 2, "y" => 2})
    assert view.inventory["wheat"] == Crops.yield_of("wheat")
    assert view.tomatoes == 0
  end

  test "planting an unknown crop is rejected" do
    FarmStore.ensure("Alice")

    assert {:error, "invalid action"} =
             FarmStore.action("Alice", %{"kind" => "plant", "x" => 0, "y" => 0, "crop" => "corn"})
  end

  test "watering uses the planted crop's grow time" do
    FarmStore.ensure("Alice")
    FarmStore.action("Alice", %{"kind" => "till", "x" => 3, "y" => 3})
    FarmStore.action("Alice", %{"kind" => "plant", "x" => 3, "y" => 3, "crop" => "barley"})
    FarmStore.action("Alice", %{"kind" => "water", "x" => 3, "y" => 3})

    tile = tile_at("Alice", 3, 3)
    assert tile.ready_at - tile.watered_at == Crops.grow_ms("barley")
  end
end
