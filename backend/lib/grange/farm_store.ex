defmodule Grange.FarmStore do
  @moduledoc """
  Owns every player's field and barn inventory, plus the lobby listings.

  State is persisted in the database, so farms survive restarts. Each
  successful change broadcasts the affected farm and the lobby summaries over
  PubSub. Tile timing uses wall-clock milliseconds (`System.system_time/1`) so
  crops keep ripening across restarts.
  """

  import Ecto.Query

  alias Grange.{Farm, FarmFence, FarmProp, FarmProps, FarmRecord, Repo, Tile}

  @lobby_topic "lobby"

  @spec ensure(String.t()) :: map()
  def ensure(owner) do
    case Repo.get(FarmRecord, owner) do
      nil ->
        %FarmRecord{owner: owner, tomatoes: 0} |> Repo.insert!()
        broadcast_change(owner)

      _farm ->
        :ok
    end

    view(owner)
  end

  @spec has_farm?(String.t()) :: boolean()
  def has_farm?(owner), do: Repo.exists?(from(f in FarmRecord, where: f.owner == ^owner))

  @spec view(String.t()) :: map() | nil
  def view(owner) do
    case Repo.get(FarmRecord, owner) do
      nil ->
        nil

      farm ->
        %{
          owner: owner,
          tiles: tiles(owner),
          tomatoes: farm.tomatoes,
          fences: fences(owner),
          fence_count: farm.fence_count,
          prop_overrides: FarmProps.overrides(owner),
          prop_inventory: FarmProps.inventory(owner)
        }
    end
  end

  @spec summaries() :: [map()]
  def summaries do
    Repo.all(from(f in FarmRecord, preload: [:tiles], order_by: f.owner))
    |> Enum.map(&summary/1)
  end

  @spec action(String.t(), map()) :: {:ok, map()} | {:error, String.t()}
  def action(owner, action) do
    case normalize(action) do
      {:ok, kind, x, y} -> run(owner, kind, x, y)
      :error -> {:error, "invalid action"}
    end
  end

  @spec prop_action(String.t(), map()) :: {:ok, map()} | {:error, String.t()}
  def prop_action(owner, action) when is_map(action) do
    result = Repo.transaction(fn -> run_prop_action(owner, action) end)

    case result do
      {:ok, :ok} ->
        broadcast_change(owner)
        {:ok, view(owner)}

      {:ok, {:error, reason}} ->
        {:error, reason}

      {:error, _} ->
        {:error, "could not update object"}
    end
  end

  def prop_action(_owner, _action), do: {:error, "invalid prop action"}

  defp run_prop_action(owner, action) do
    case fetch(action, "kind") do
      "dig" ->
        FarmProps.dig(owner, to_integer(fetch(action, "index")))

      "place" ->
        FarmProps.place(
          owner,
          fetch(action, "asset"),
          to_integer(fetch(action, "x")),
          to_integer(fetch(action, "y"))
        )

      _ ->
        {:error, "invalid prop action"}
    end
  end

  @spec sell_tomatoes(String.t(), integer()) :: {:ok, map()} | {:error, String.t()}
  def sell_tomatoes(owner, count) when is_integer(count) and count > 0 do
    case Repo.get(FarmRecord, owner) do
      %FarmRecord{tomatoes: tomatoes} = farm when tomatoes >= count ->
        farm
        |> Ecto.Changeset.change(tomatoes: tomatoes - count)
        |> Repo.update!()

        broadcast_change(owner)
        {:ok, view(owner)}

      %FarmRecord{} ->
        {:error, "not enough tomatoes"}

      nil ->
        {:error, "farm not found"}
    end
  end

  def sell_tomatoes(_owner, _count), do: {:error, "invalid count"}

  @spec tick(integer()) :: [String.t()]
  def tick(now \\ System.system_time(:millisecond)) do
    ready =
      Repo.all(
        from(t in Tile,
          where: t.state == :watered and not is_nil(t.ready_at) and t.ready_at <= ^now
        )
      )

    owners = ready |> Enum.map(& &1.owner) |> Enum.uniq() |> Enum.sort()
    Enum.each(ready, &Repo.update!(Ecto.Changeset.change(&1, state: :ready)))
    Enum.each(owners, &broadcast_farm/1)
    if owners != [], do: broadcast_lobby()
    owners
  end

  @spec reset() :: :ok
  def reset do
    Repo.delete_all(Tile)
    Repo.delete_all(FarmFence)
    Repo.delete_all(FarmProp)
    Repo.delete_all(FarmRecord)
    :ok
  end

  defp run(owner, kind, x, y) do
    bounds? =
      if kind in [:place_fence, :remove_fence],
        do: x in 0..17 and y in 0..9,
        else: Farm.in_bounds?(x, y)

    if bounds? do
      apply_action(owner, kind, x, y)
    else
      {:error, "out of bounds"}
    end
  end

  defp apply_action(owner, kind, x, y) do
    case Repo.transaction(fn -> mutate(owner, kind, x, y) end) do
      {:ok, :ok} ->
        broadcast_change(owner)
        {:ok, view(owner)}

      {:ok, {:error, reason}} ->
        {:error, reason}

      {:error, _reason} ->
        {:error, "could not update farm"}
    end
  end

  defp mutate(owner, :till, x, y) do
    case tile_at(owner, x, y) do
      nil ->
        %Tile{}
        |> Tile.changeset(%{owner: owner, x: x, y: y, state: :tilled, crop: "tomato"})
        |> Repo.insert!()

        :ok

      _tile ->
        {:error, "tile is already tilled"}
    end
  end

  defp mutate(owner, :place_fence, x, y) do
    farm = Repo.get!(FarmRecord, owner)

    cond do
      farm.fence_count <= 0 ->
        {:error, "no fences left"}

      fence_at(owner, x, y) ->
        {:error, "fence already here"}

      tile_at(owner, x, y) ->
        {:error, "crop tile is in the way"}

      true ->
        Repo.insert!(%FarmFence{owner: owner, x: x, y: y})
        Repo.update!(Ecto.Changeset.change(farm, fence_count: farm.fence_count - 1))
        :ok
    end
  end

  defp mutate(owner, :remove_fence, x, y) do
    case fence_at(owner, x, y) do
      nil ->
        {:error, "no fence here"}

      fence ->
        Repo.delete!(fence)
        farm = Repo.get!(FarmRecord, owner)
        Repo.update!(Ecto.Changeset.change(farm, fence_count: farm.fence_count + 1))
        :ok
    end
  end

  defp mutate(owner, kind, x, y) do
    case tile_at(owner, x, y) do
      nil -> {:error, "no tilled tile here"}
      tile -> transform(owner, tile, kind)
    end
  end

  defp transform(_owner, tile, :plant) do
    with {:ok, planted} <- Farm.plant(tile, now_ms()) do
      update_tile(tile, planted)
    end
  end

  defp transform(_owner, tile, :water) do
    with {:ok, watered} <- Farm.water(tile, now_ms()) do
      update_tile(tile, watered)
    end
  end

  defp transform(owner, tile, :harvest) do
    with {:ok, harvested} <- Farm.harvest(tile) do
      update_tile(tile, harvested)
      add_tomatoes(owner, Farm.harvest_yield())
    end
  end

  defp update_tile(tile, changed) do
    tile
    |> Ecto.Changeset.change(%{
      state: changed.state,
      planted_at: changed.planted_at,
      watered_at: changed.watered_at,
      ready_at: changed.ready_at
    })
    |> Repo.update!()

    :ok
  end

  defp add_tomatoes(owner, count) do
    farm = Repo.get!(FarmRecord, owner)
    Repo.update!(Ecto.Changeset.change(farm, tomatoes: farm.tomatoes + count))
    :ok
  end

  @kinds %{
    "till" => :till,
    "plant" => :plant,
    "water" => :water,
    "harvest" => :harvest,
    "place_fence" => :place_fence,
    "remove_fence" => :remove_fence
  }

  defp normalize(action) when is_map(action) do
    kind = Map.get(@kinds, to_string(fetch(action, "kind")))
    x = to_integer(fetch(action, "x"))
    y = to_integer(fetch(action, "y"))

    if kind && is_integer(x) && is_integer(y) do
      {:ok, kind, x, y}
    else
      :error
    end
  end

  defp normalize(_action), do: :error

  defp fetch(map, key), do: Map.get(map, key) || Map.get(map, String.to_atom(key))
  defp to_integer(value) when is_integer(value), do: value
  defp to_integer(value) when is_binary(value), do: safe_to_integer(value)
  defp to_integer(_value), do: nil

  defp safe_to_integer(value) do
    case Integer.parse(value) do
      {int, ""} -> int
      _ -> nil
    end
  end

  defp tile_at(owner, x, y) do
    Repo.one(from(t in Tile, where: t.owner == ^owner and t.x == ^x and t.y == ^y))
  end

  defp fence_at(owner, x, y) do
    Repo.one(from(f in FarmFence, where: f.owner == ^owner and f.x == ^x and f.y == ^y))
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
      planted_at: tile.planted_at,
      watered_at: tile.watered_at,
      ready_at: tile.ready_at
    }
  end

  defp summary(farm) do
    counts = Enum.frequencies_by(farm.tiles, & &1.state)

    %{
      owner: farm.owner,
      tiles: length(farm.tiles),
      planted: Map.get(counts, :planted, 0),
      watered: Map.get(counts, :watered, 0),
      ready: Map.get(counts, :ready, 0),
      tomatoes: farm.tomatoes
    }
  end

  defp broadcast_change(owner) do
    broadcast_farm(owner)
    broadcast_lobby()
  end

  defp broadcast_farm(owner) do
    GrangeWeb.Endpoint.broadcast("farm:" <> owner, "farmUpdate", %{farm: view(owner)})
  end

  defp broadcast_lobby do
    GrangeWeb.Endpoint.broadcast(@lobby_topic, "farms", %{farms: summaries()})
  end

  defp now_ms, do: System.system_time(:millisecond)
end
