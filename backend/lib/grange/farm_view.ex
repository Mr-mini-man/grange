defmodule Grange.FarmView do
  @moduledoc """
  Builds the client-facing snapshot of a farm from its persisted rows.

  Kept out of `Grange.FarmStore` so the store stays focused on mutations and
  broadcasts. The snapshot bundles the field tiles, barn inventory, brewery
  state, placed fences, and movable props the client needs to render a farm.
  """

  import Ecto.Query

  alias Grange.{Brewery, FarmFence, FarmProps, FarmRecord, Inventory, Repo, Tile}

  @doc "The full snapshot sent to a farm channel's visitors."
  @spec snapshot(FarmRecord.t()) :: map()
  def snapshot(%FarmRecord{} = farm) do
    %{
      owner: farm.owner,
      tiles: tiles(farm.owner),
      tomatoes: farm.tomatoes,
      inventory: Inventory.load(farm),
      brewery: brewery(farm),
      fences: fences(farm.owner),
      fence_count: farm.fence_count,
      prop_overrides: FarmProps.overrides(farm.owner),
      prop_inventory: FarmProps.inventory(farm.owner)
    }
  end

  @doc "The active potion effects on a farm's brewery."
  @spec effects(FarmRecord.t()) :: map()
  def effects(%FarmRecord{} = farm) do
    farm |> Inventory.load_brewery() |> Map.get("effects", %{})
  end

  defp tiles(owner) do
    from(t in Tile, where: t.owner == ^owner, order_by: [t.x, t.y])
    |> Repo.all()
    |> Enum.map(&tile_view/1)
  end

  defp tile_view(tile) do
    %{
      x: tile.x,
      y: tile.y,
      state: tile.state,
      crop: tile.crop,
      cropId: tile.crop,
      planted_at: tile.planted_at,
      watered_at: tile.watered_at,
      ready_at: tile.ready_at
    }
  end

  defp fences(owner) do
    Repo.all(
      from(f in FarmFence,
        where: f.owner == ^owner,
        order_by: [f.x, f.y],
        select: %{x: f.x, y: f.y}
      )
    )
  end

  defp brewery(farm) do
    brewery = Inventory.load_brewery(farm)
    effects = Brewery.prune_effects(brewery["effects"] || %{}, now_ms())

    %{
      built: brewery["built"] == true,
      effects: Enum.map(effects, fn {kind, expires} -> %{kind: kind, expiresAt: expires} end)
    }
  end

  defp now_ms, do: System.system_time(:millisecond)
end
