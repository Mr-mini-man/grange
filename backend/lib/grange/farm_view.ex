defmodule Grange.FarmView do
  @moduledoc """
  Read-only projections of a persisted farm for channel replies and summaries.
  """

  import Ecto.Query

  alias Grange.{
    Barn,
    BarnStorage,
    FarmAnimals,
    FarmFences,
    FarmGates,
    FarmProps,
    FarmRecord,
    FarmSprinklers,
    FarmTrain,
    Repo,
    Tile,
    WorldClock
  }

  @doc "The full active-farm projection sent to a joined channel and the lobby."
  @spec active(FarmRecord.t()) :: map()
  def active(farm) do
    owner = farm.owner
    barn = Barn.map(owner)
    time = WorldClock.snapshot()

    %{
      owner: owner,
      tiles: tiles(owner),
      barn: barn,
      tomatoes: Map.get(barn, "tomato", 0),
      fences: FarmFences.list(owner),
      fence_count: farm.fence_count,
      gates: FarmGates.list(owner),
      gate_count: farm.gate_count,
      sprinklers: FarmSprinklers.list(owner),
      sprinkler_count: farm.sprinkler_count,
      animals: farm.animals,
      placed_animals: FarmAnimals.list(owner),
      land_level: farm.land_level,
      is_public: farm.is_public,
      visitor_edit: farm.visitor_edit,
      prop_overrides: FarmProps.overrides(owner),
      prop_inventory: FarmProps.inventory(owner),
      storage: BarnStorage.inventory(farm),
      train: FarmTrain.view(farm),
      time: time,
      cycle_time_ms: time.cycle_time_ms,
      day_phase: time.phase
    }
  end

  @doc "The farm's tiles as plain maps ordered by position."
  @spec tiles(String.t()) :: [map()]
  def tiles(owner) do
    from(t in Tile, where: t.owner == ^owner, order_by: [t.x, t.y])
    |> Repo.all()
    |> Enum.map(&tile_view/1)
  end

  @doc "A compact row for the lobby's farm list."
  @spec summary(FarmRecord.t()) :: map()
  def summary(farm) do
    counts = Enum.frequencies_by(farm.tiles, & &1.state)
    tomatoes = Enum.find_value(farm.barn_items, 0, &if(&1.item == "tomato", do: &1.count))

    %{
      owner: farm.owner,
      tiles: length(farm.tiles),
      planted: Map.get(counts, :planted, 0),
      watered: Map.get(counts, :watered, 0),
      ready: Map.get(counts, :ready, 0),
      tomatoes: tomatoes,
      is_public: farm.is_public
    }
  end

  defp tile_view(tile) do
    Map.take(tile, [:x, :y, :state, :crop, :planted_at, :watered_at, :ready_at])
  end
end
