defmodule Grange.FarmTrain do
  @moduledoc """
  The owner's train: an engine upgrade tier plus the cargo carts it pulls.

  The starter train is one tier-0 engine and one tier-1 cart. Upgrading the
  engine makes trips faster and lets it pull more carts; upgrading a cart adds
  cargo slots. Cargo is stored per cart so a deposit lands in a specific cart.

  Mirrors the shared TypeScript rules in `shared/train.ts`; keep the numbers in
  sync. Pure state lives on the `farms` row (`train_engine`, `train_carts`,
  `train_cargo`), and every mutation writes those columns through Ecto.
  """

  alias Grange.{FarmRecord, Repo}

  @max_engine 3
  @max_cart_tier 3
  @stack_limit 99
  @capacities %{1 => 2, 2 => 3, 3 => 4}
  @engine_carts %{0 => 1, 1 => 2, 2 => 3, 3 => 4}
  @item_format ~r/^[a-z0-9_-]{1,32}$/

  @doc "The whole train view for a farm row."
  @spec view(FarmRecord.t()) :: map()
  def view(%FarmRecord{} = farm) do
    carts = normalize_carts(farm.train_carts)
    cargo = normalize_cargo(farm.train_cargo)

    %{
      engine: clamp_engine(farm.train_engine),
      max_carts: carts_for(farm.train_engine),
      carts:
        carts
        |> Enum.sort_by(fn {index, _tier} -> index end)
        |> Enum.map(fn {index, tier} ->
          %{
            index: index,
            tier: tier,
            capacity: Map.fetch!(@capacities, tier),
            cargo: Map.get(cargo, Integer.to_string(index), %{})
          }
        end)
    }
  end

  @doc "Spends nothing; raises the engine tier by one, up to the cap."
  @spec upgrade_engine(String.t()) :: {:ok, :ok} | {:error, String.t()}
  def upgrade_engine(owner) do
    case fetch(owner) do
      nil -> {:error, "farm not found"}
      farm -> upgrade_engine(farm, clamp_engine(farm.train_engine))
    end
  end

  defp upgrade_engine(_farm, engine) when engine >= @max_engine,
    do: {:error, "the engine is already fully upgraded"}

  defp upgrade_engine(farm, engine), do: commit(farm, %{train_engine: engine + 1})

  @doc "Couples one more tier-1 cart, up to what the engine can pull."
  @spec add_cart(String.t()) :: {:ok, :ok} | {:error, String.t()}
  def add_cart(owner) do
    case fetch(owner) do
      nil ->
        {:error, "farm not found"}

      farm ->
        carts = normalize_carts(farm.train_carts)

        if map_size(carts) >= carts_for(farm.train_engine) do
          {:error, "upgrade the engine to pull more carts"}
        else
          commit(farm, %{train_carts: serialize_carts(carts, map_size(carts) + 1, 1)})
        end
    end
  end

  @doc "Raises the lowest-tier cart by one, up to the cart cap."
  @spec upgrade_cart(String.t()) :: {:ok, :ok} | {:error, String.t()}
  def upgrade_cart(owner) do
    case fetch(owner) do
      nil ->
        {:error, "farm not found"}

      farm ->
        carts = normalize_carts(farm.train_carts)

        case lowest_cart(carts) do
          nil -> {:error, "every cart is already fully upgraded"}
          {index, tier} -> commit(farm, %{train_carts: serialize_carts(carts, index, tier + 1)})
        end
    end
  end

  @doc "Deposits into, or withdraws from, the train's cargo carts."
  @spec action(String.t(), map()) :: {:ok, :ok} | {:error, String.t()}
  def action(owner, action) when is_map(action) do
    with {:ok, kind, item, count, cart} <- parse(action),
         %FarmRecord{} = farm <- fetch(owner) do
      move(farm, kind, item, count, cart)
    else
      nil -> {:error, "farm not found"}
      {:error, reason} -> {:error, reason}
    end
  end

  def action(_owner, _action), do: {:error, "invalid train action"}

  defp move(farm, "deposit", item, count, _cart) do
    carts = normalize_carts(farm.train_carts)
    cargo = normalize_cargo(farm.train_cargo)

    case deposit(carts, cargo, item, count) do
      {:ok, next} -> commit(farm, %{train_cargo: next})
      {:error, reason} -> {:error, reason}
    end
  end

  defp move(farm, "withdraw", item, count, cart) do
    carts = normalize_carts(farm.train_carts)

    with index when is_integer(index) <- to_index(cart),
         true <- Map.has_key?(carts, index) do
      cargo = normalize_cargo(farm.train_cargo)
      move_out(farm, cargo, index, item, count)
    else
      _ -> {:error, "no such cart"}
    end
  end

  defp move_out(farm, cargo, index, item, count) do
    case withdraw(cargo, index, item, count) do
      {:ok, next} -> commit(farm, %{train_cargo: next})
      {:error, reason} -> {:error, reason}
    end
  end

  # -- cargo rules ---------------------------------------------------------

  defp deposit(carts, cargo, item, count) do
    target =
      carts
      |> Enum.sort_by(fn {index, _tier} -> index end)
      |> Enum.find(fn {index, tier} -> room(cargo, index, tier, item) > 0 end)

    case target do
      nil ->
        {:error, "the train is full"}

      {index, tier} ->
        if count > room(cargo, index, tier, item) do
          {:error, "the train is full"}
        else
          current = cart_cargo(cargo, index) |> Map.update(item, count, &(&1 + count))
          {:ok, Map.put(cargo, Integer.to_string(index), current)}
        end
    end
  end

  defp room(cargo, index, tier, item) do
    current = cart_cargo(cargo, index)
    have = Map.get(current, item, 0)

    cond do
      have > 0 -> @stack_limit - have
      active_count(current) >= Map.fetch!(@capacities, tier) -> 0
      true -> @stack_limit
    end
  end

  defp withdraw(cargo, index, item, count) do
    current = cart_cargo(cargo, index)
    have = Map.get(current, item, 0)

    if have >= count do
      remaining = have - count

      next =
        if remaining == 0,
          do: Map.delete(current, item),
          else: Map.put(current, item, remaining)

      finished =
        if map_size(next) == 0,
          do: Map.delete(cargo, Integer.to_string(index)),
          else: Map.put(cargo, Integer.to_string(index), next)

      {:ok, finished}
    else
      {:error, "not enough in the cart"}
    end
  end

  defp cart_cargo(cargo, index), do: Map.get(cargo, Integer.to_string(index), %{})
  defp active_count(cargo), do: Enum.count(cargo, fn {_item, count} -> count > 0 end)

  # -- parsing and normalisation ------------------------------------------

  defp parse(action) do
    kind = fetch(action, "kind")
    item = fetch(action, "item")
    count = fetch(action, "count")

    cond do
      kind not in ["deposit", "withdraw"] ->
        {:error, "invalid train action"}

      not valid_item?(item) ->
        {:error, "invalid item"}

      not (is_integer(count) and count >= 1 and count <= @stack_limit) ->
        {:error, "invalid count"}

      true ->
        {:ok, kind, item, count, fetch(action, "cart")}
    end
  end

  defp fetch(map, key) when is_map(map),
    do: Map.get(map, key) || Map.get(map, String.to_atom(key))

  defp fetch(_map, _key), do: nil

  defp valid_item?(item), do: is_binary(item) and Regex.match?(@item_format, item)

  # Carts are stored as `%{slot => tier}`; an empty map is the starter cart.
  defp normalize_carts(carts) when is_map(carts) and map_size(carts) > 0 do
    carts
    |> Enum.map(fn {index, tier} -> {to_index(index), clamp_tier(tier)} end)
    |> Enum.reject(fn {index, _tier} -> is_nil(index) end)
    |> Enum.sort_by(fn {index, _tier} -> index end)
    |> Enum.with_index(1)
    |> Map.new(fn {{_old, tier}, slot} -> {slot, tier} end)
  end

  defp normalize_carts(_carts), do: %{1 => 1}

  defp serialize_carts(carts, index, tier) do
    carts
    |> Map.put(index, clamp_tier(tier))
    |> Map.new(fn {slot, value} -> {Integer.to_string(slot), value} end)
  end

  defp lowest_cart(carts) do
    carts
    |> Enum.filter(fn {_index, tier} -> tier < @max_cart_tier end)
    |> Enum.min_by(fn {index, tier} -> {tier, index} end, fn -> nil end)
  end

  defp normalize_cargo(cargo) when is_map(cargo) do
    cargo
    |> Enum.map(fn {index, items} -> {to_index(index), clean_items(items)} end)
    |> Enum.reject(fn {index, items} -> is_nil(index) or items == %{} end)
    |> Map.new(fn {index, items} -> {Integer.to_string(index), items} end)
  end

  defp normalize_cargo(_cargo), do: %{}

  defp clean_items(items) when is_map(items) do
    items
    |> Enum.filter(fn {item, count} ->
      valid_item?(item) and is_integer(count) and count > 0
    end)
    |> Map.new(fn {item, count} -> {item, min(count, @stack_limit)} end)
  end

  defp clean_items(_items), do: %{}

  defp carts_for(engine), do: Map.fetch!(@engine_carts, clamp_engine(engine))
  defp clamp_engine(engine) when is_integer(engine), do: engine |> max(0) |> min(@max_engine)
  defp clamp_engine(_engine), do: 0
  defp clamp_tier(tier) when is_integer(tier), do: tier |> max(1) |> min(@max_cart_tier)
  defp clamp_tier(_tier), do: 1

  defp to_index(value) when is_integer(value) and value > 0, do: value

  defp to_index(value) when is_binary(value) do
    case Integer.parse(value) do
      {int, ""} when int > 0 -> int
      _ -> nil
    end
  end

  defp to_index(_value), do: nil

  defp fetch(owner), do: Repo.get(FarmRecord, owner)

  defp commit(farm, attrs) do
    farm |> Ecto.Changeset.change(attrs) |> Repo.update!()
    {:ok, :ok}
  end
end
