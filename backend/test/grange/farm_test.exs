defmodule Grange.FarmTest do
  @moduledoc false
  use ExUnit.Case, async: true

  alias Grange.Farm

  test "in_bounds?/2 accepts only integer coordinates inside the grid" do
    size = Farm.grid_size()
    assert Farm.in_bounds?(0, 0)
    assert Farm.in_bounds?(size - 1, size - 1)
    refute Farm.in_bounds?(-1, 0)
    refute Farm.in_bounds?(size, 0)
    refute Farm.in_bounds?(1.5, 2)
    refute Farm.in_bounds?("1", 2)
  end

  test "new_tile/2 starts tilled with a tomato crop" do
    tile = Farm.new_tile(2, 3)

    assert tile.x == 2
    assert tile.y == 3
    assert tile.state == :tilled
    assert tile.crop == "tomato"
    assert tile.planted_at == nil
    assert tile.ready_at == nil
  end

  test "plant/2 only accepts a tilled tile" do
    assert {:ok, planted} = Farm.plant(Farm.new_tile(1, 1), 100)
    assert planted.state == :planted
    assert planted.planted_at == 100

    assert {:error, "tile is not tilled"} = Farm.plant(planted, 200)
  end

  test "water/2 schedules readiness once, from a planted tile" do
    {:ok, planted} = Farm.plant(Farm.new_tile(1, 1), 100)
    assert {:ok, watered} = Farm.water(planted, 200)

    assert watered.state == :watered
    assert watered.watered_at == 200
    assert watered.ready_at == 200 + Farm.grow_ms()

    assert {:error, "tile is not planted"} = Farm.water(watered, 300)
  end

  test "ready?/2 and mark_ready/1 move a watered tile to ready" do
    {:ok, planted} = Farm.plant(Farm.new_tile(0, 0), 0)
    {:ok, watered} = Farm.water(planted, 0)
    ready_at = watered.ready_at

    refute Farm.ready?(watered, ready_at - 1)
    assert Farm.ready?(watered, ready_at)

    assert %{state: :ready} = Farm.mark_ready(watered)
    refute Farm.ready?(Farm.new_tile(0, 0), 10_000)
  end

  test "harvest/1 returns a ready tile to freshly tilled ground" do
    {:ok, planted} = Farm.plant(Farm.new_tile(4, 4), 0)
    {:ok, watered} = Farm.water(planted, 0)
    ready = Farm.mark_ready(watered)

    assert {:ok, tilled} = Farm.harvest(ready)
    assert tilled.state == :tilled
    assert tilled.watered_at == nil
    assert tilled.ready_at == nil

    assert {:error, "tile is not ready"} = Farm.harvest(tilled)
  end
end
