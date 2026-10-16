defmodule Grange.Brewery do
  @moduledoc """
  Pure brewing rules: potion recipes, materials, and timed effects.

  The brewhouse turns harvested crops into potions. Materials build it, and a
  potion grants one timed buff (faster growth, faster movement, or a bigger
  harvest). Everything here is data plus pure helpers; `Grange.BreweryStore`
  applies them to a persisted farm.
  """

  alias Grange.{Crops, Inventory}

  @growth_multiplier 0.5
  @speed_multiplier 1.6
  @luck_bonus 2

  @potions %{
    "greenThumb" => %{
      name: "Green Thumb",
      recipe: %{"wheat" => 2, "potato" => 1},
      effect: "growth",
      duration_ms: 60_000,
      bar_price: 12
    },
    "swiftSip" => %{
      name: "Swift Sip",
      recipe: %{"barley" => 2, "tomato" => 1},
      effect: "speed",
      duration_ms: 45_000,
      bar_price: 10
    },
    "luckyDraught" => %{
      name: "Lucky Draught",
      recipe: %{"wheat" => 1, "potato" => 2, "barley" => 1},
      effect: "luck",
      duration_ms: 60_000,
      bar_price: 20
    }
  }

  @materials %{"wood" => %{name: "Wood", price: 3}, "stone" => %{name: "Stone", price: 4}}

  @brewery_cost %{"wood" => 10, "stone" => 8, "coins" => 25}

  @doc "Every potion id."
  @spec potion_ids() :: [String.t()]
  def potion_ids, do: Map.keys(@potions)

  @doc "True when `id` names a known potion."
  @spec known_potion?(term()) :: boolean()
  def known_potion?(id), do: Map.has_key?(@potions, id)

  @doc "A potion's metadata, or nil when unknown."
  @spec potion(term()) :: map() | nil
  def potion(id), do: Map.get(@potions, id)

  @doc "The cost in materials and coins to build a brewery."
  @spec brewery_cost() :: map()
  def brewery_cost, do: @brewery_cost

  @doc "True when `id` names a known material."
  @spec known_material?(term()) :: boolean()
  def known_material?(id), do: Map.has_key?(@materials, id)

  @doc "A material's metadata, or nil when unknown."
  @spec material(term()) :: map() | nil
  def material(id), do: Map.get(@materials, id)

  @doc "True when the inventory holds every ingredient in a potion's recipe."
  @spec can_brew?(map(), String.t()) :: boolean()
  def can_brew?(inv, potion_id) do
    case potion(potion_id) do
      %{recipe: recipe} ->
        Enum.all?(recipe, fn {crop, count} -> Inventory.get(inv, crop) >= count end)

      nil ->
        false
    end
  end

  @doc "True when the inventory can pay the full brewery build cost."
  @spec can_build?(map()) :: boolean()
  def can_build?(inv) do
    Enum.all?(@brewery_cost, fn {key, cost} -> Inventory.get(inv, key) >= cost end)
  end

  @doc "True when an effect of `kind` is still running at `now` (ms)."
  @spec active_effect?(map(), String.t(), integer()) :: boolean()
  def active_effect?(effects, kind, now) when is_map(effects) do
    case Map.get(effects, kind) do
      expires -> is_integer(expires) and expires > now
    end
  end

  def active_effect?(_effects, _kind, _now), do: false

  @doc "Crop growth time after any active Green Thumb effect."
  @spec growth_ms(String.t(), map(), integer()) :: pos_integer()
  def growth_ms(crop_id, effects, now) do
    base = Crops.grow_ms(crop_id)
    if active_effect?(effects, "growth", now), do: round(base * @growth_multiplier), else: base
  end

  @doc "Harvest yield after any active Lucky Draught effect."
  @spec harvest_yield(String.t(), map(), integer()) :: pos_integer()
  def harvest_yield(crop_id, effects, now) do
    base = Crops.yield_of(crop_id)
    if active_effect?(effects, "luck", now), do: base + @luck_bonus, else: base
  end

  @doc "Movement multiplier the client applies while Swift Sip runs."
  @spec move_speed_multiplier(map(), integer()) :: float()
  def move_speed_multiplier(effects, now) do
    if active_effect?(effects, "speed", now), do: @speed_multiplier, else: 1.0
  end

  @doc "Drops lapsed effects, returning the surviving `kind => expires_at` map."
  @spec prune_effects(map(), integer()) :: map()
  def prune_effects(effects, now) when is_map(effects) do
    Map.filter(effects, fn {_kind, expires} -> is_integer(expires) and expires > now end)
  end

  def prune_effects(_effects, _now), do: %{}
end
