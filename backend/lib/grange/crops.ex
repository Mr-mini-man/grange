defmodule Grange.Crops do
  @moduledoc """
  The crop catalogue: growth time, harvest yield, and seed/crop prices.

  Crops are the raw input to the brewery. Tomato is the starting crop (and
  the barn's `tomatoes` column); the rest live in the farm's inventory map.
  Keeping the table here means the tile rules (`Grange.Farm`) and the
  brewery rules (`Grange.Brewery`) share one source of truth.
  """

  @crops %{
    "tomato" => %{
      name: "Tomato",
      seed_key: "tomatoSeed",
      grow_ms: 10_000,
      yield: 3,
      seed_price: 2,
      crop_price: 1
    },
    "wheat" => %{
      name: "Wheat",
      seed_key: "wheatSeed",
      grow_ms: 12_000,
      yield: 4,
      seed_price: 2,
      crop_price: 1
    },
    "potato" => %{
      name: "Potato",
      seed_key: "potatoSeed",
      grow_ms: 15_000,
      yield: 3,
      seed_price: 3,
      crop_price: 2
    },
    "barley" => %{
      name: "Barley",
      seed_key: "barleySeed",
      grow_ms: 18_000,
      yield: 3,
      seed_price: 3,
      crop_price: 2
    }
  }

  @doc "Every known crop id."
  @spec ids() :: [String.t()]
  def ids, do: Map.keys(@crops)

  @doc "True when `id` names a known crop."
  @spec known?(term()) :: boolean()
  def known?(id), do: Map.has_key?(@crops, id)

  @doc "The crop's metadata, or nil when unknown."
  @spec get(term()) :: map() | nil
  def get(id), do: Map.get(@crops, id)

  @doc "The crop's metadata, raising when unknown."
  @spec fetch!(String.t()) :: map()
  def fetch!(id), do: Map.fetch!(@crops, id)

  @doc "Base milliseconds from watering to harvest for a crop."
  @spec grow_ms(String.t()) :: pos_integer()
  def grow_ms(id), do: fetch!(id).grow_ms

  @doc "Base units produced by one harvest of a crop."
  @spec yield_of(String.t()) :: pos_integer()
  def yield_of(id), do: fetch!(id).yield

  @doc "The inventory key that holds a crop's harvested units."
  @spec key(String.t()) :: String.t()
  def key(id), do: id
end
