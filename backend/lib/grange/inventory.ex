defmodule Grange.Inventory do
  @moduledoc """
  Reads and writes the JSON `inventory` and `brewery` maps on a farm row.

  The maps are persisted so a player's materials, seeds, crops, potions, and
  brewhouse survive restarts. Tomato is special-cased onto the farm's
  `tomatoes` column for backward compatibility, so it is stripped before the
  map is written and re-injected when a row is loaded.
  """

  alias Grange.FarmRecord

  @default %{
    "coins" => 100,
    "wood" => 0,
    "stone" => 0,
    "tomatoSeed" => 0,
    "tomato" => 0,
    "wheatSeed" => 0,
    "wheat" => 0,
    "potatoSeed" => 0,
    "potato" => 0,
    "barleySeed" => 0,
    "barley" => 0,
    "potions" => %{"greenThumb" => 0, "swiftSip" => 0, "luckyDraught" => 0}
  }

  @brewery %{"built" => false, "effects" => %{}}

  @doc "The starting inventory for a new farm."
  @spec default() :: map()
  def default, do: @default

  @doc "The starting brewhouse state for a new farm."
  @spec brewery_default() :: map()
  def brewery_default, do: @brewery

  @doc "Loads a farm's inventory, filling defaults and the tomato column."
  @spec load(FarmRecord.t()) :: map()
  def load(%FarmRecord{} = farm) do
    farm.inventory
    |> merge_defaults()
    |> Map.put("tomato", farm.tomatoes || 0)
  end

  @doc "Loads a farm's brewhouse state, filling defaults."
  @spec load_brewery(FarmRecord.t()) :: map()
  def load_brewery(%FarmRecord{brewery: brewery}) when is_map(brewery) do
    Map.merge(@brewery, brewery)
  end

  def load_brewery(%FarmRecord{}), do: @brewery

  @doc "Changeset attributes that persist an inventory without a stale tomato."
  @spec attrs(map()) :: map()
  def attrs(inv), do: %{inventory: Map.delete(inv, "tomato"), tomatoes: get(inv, "tomato")}

  @doc "Reads an integer count, defaulting to zero."
  @spec get(map(), String.t()) :: integer()
  def get(inv, key), do: Map.get(inv, key, 0)

  @doc "Reads a potion count, defaulting to zero."
  @spec potion(map(), String.t()) :: integer()
  def potion(inv, id), do: inv |> Map.get("potions", %{}) |> Map.get(id, 0)

  @doc "Adds `amount` to an inventory key."
  @spec add(map(), String.t(), integer()) :: map()
  def add(inv, key, amount), do: Map.update(inv, key, amount, &(&1 + amount))

  @doc "Subtracts `amount` from an inventory key."
  @spec sub(map(), String.t(), integer()) :: map()
  def sub(inv, key, amount), do: Map.update(inv, key, -amount, &(&1 - amount))

  @doc "Adds `amount` to a potion count."
  @spec add_potion(map(), String.t(), integer()) :: map()
  def add_potion(inv, id, amount) do
    Map.update(inv, "potions", %{id => amount}, fn potions ->
      Map.update(potions, id, amount, fn current -> current + amount end)
    end)
  end

  defp merge_defaults(nil), do: @default

  defp merge_defaults(map) when is_map(map) do
    Map.merge(@default, map, fn
      "potions", default, saved when is_map(saved) ->
        Map.merge(default, saved)

      _key, _default, saved ->
        saved
    end)
  end

  defp merge_defaults(_other), do: @default
end
