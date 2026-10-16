defmodule Grange.BreweryStore do
  @moduledoc """
  Persists the brewery economy: market purchases, brewing, and bar sales.

  Every action is server-authoritative and keyed off the farm's persisted
  inventory map, so a client can only ever spend what it actually owns.
  Quantities are validated as bounded positive integers and unknown crops,
  materials, and potions are rejected rather than coerced.
  """

  alias Grange.{Brewery, Crops, FarmRecord, FarmStore, Inventory, Repo}

  @max_quantity 1_000

  @doc "Buys `quantity` seeds of a crop from the market."
  @spec buy_seed(String.t(), String.t(), integer()) :: {:ok, map()} | {:error, String.t()}
  def buy_seed(owner, crop_id, quantity) do
    with {:ok, quantity} <- valid_quantity(quantity),
         %{} = crop <- Crops.get(crop_id) do
      spend(owner, crop.seed_price * quantity, &Inventory.add(&1, crop.seed_key, quantity))
    else
      nil -> {:error, "unknown seed"}
      {:error, reason} -> {:error, reason}
    end
  end

  @doc "Buys `quantity` units of a building material from the market."
  @spec buy_material(String.t(), String.t(), integer()) :: {:ok, map()} | {:error, String.t()}
  def buy_material(owner, material_id, quantity) do
    with {:ok, quantity} <- valid_quantity(quantity),
         %{} = material <- Brewery.material(material_id) do
      spend(owner, material.price * quantity, &Inventory.add(&1, material_id, quantity))
    else
      nil -> {:error, "unknown material"}
      {:error, reason} -> {:error, reason}
    end
  end

  @doc "Builds the farm's brewery once, paying the material and coin cost."
  @spec build_brewery(String.t()) :: {:ok, map()} | {:error, String.t()}
  def build_brewery(owner) do
    with {:ok, farm} <- fetch_farm(owner) do
      brewery = Inventory.load_brewery(farm)
      inv = Inventory.load(farm)

      cond do
        brewery["built"] == true ->
          {:error, "brewery already built"}

        not Brewery.can_build?(inv) ->
          {:error, "not enough materials or coins"}

        true ->
          cost = Brewery.brewery_cost()

          inv =
            inv
            |> Inventory.sub("wood", cost["wood"])
            |> Inventory.sub("stone", cost["stone"])
            |> Inventory.sub("coins", cost["coins"])

          save(farm, inv, Map.put(brewery, "built", true))
      end
    end
  end

  @doc "Brews one potion, consuming its recipe from the inventory."
  @spec brew(String.t(), String.t()) :: {:ok, map()} | {:error, String.t()}
  def brew(owner, potion_id) do
    case {Brewery.potion(potion_id), fetch_farm(owner)} do
      {nil, _} -> {:error, "unknown potion"}
      {_, {:error, reason}} -> {:error, reason}
      {potion, {:ok, farm}} -> brew_at(farm, potion, potion_id)
    end
  end

  defp brew_at(farm, potion, potion_id) do
    brewery = Inventory.load_brewery(farm)
    inv = Inventory.load(farm)

    cond do
      brewery["built"] != true ->
        {:error, "build a brewery first"}

      not Brewery.can_brew?(inv, potion_id) ->
        {:error, "missing crops"}

      true ->
        save(farm, consume(inv, potion, potion_id), brewery)
    end
  end

  defp consume(inv, potion, potion_id) do
    base = Inventory.add_potion(inv, potion_id, 1)

    Enum.reduce(potion.recipe, base, fn {crop, count}, acc ->
      Inventory.sub(acc, crop, count)
    end)
  end

  @doc "Sells one potion to the bar for grangecoins."
  @spec sell_potion(String.t(), String.t()) :: {:ok, map()} | {:error, String.t()}
  def sell_potion(owner, potion_id) do
    with %{} = potion <- Brewery.potion(potion_id),
         {:ok, farm} <- fetch_farm(owner) do
      inv = Inventory.load(farm)

      if Inventory.potion(inv, potion_id) > 0 do
        inv =
          inv
          |> Inventory.add_potion(potion_id, -1)
          |> Inventory.add("coins", potion.bar_price)

        save(farm, inv, Inventory.load_brewery(farm))
      else
        {:error, "no potion to sell"}
      end
    else
      nil -> {:error, "unknown potion"}
      {:error, reason} -> {:error, reason}
    end
  end

  @doc "Sells one harvested crop to the bar for grangecoins."
  @spec sell_crop(String.t(), String.t()) :: {:ok, map()} | {:error, String.t()}
  def sell_crop(owner, crop_id) do
    with %{} = crop <- Crops.get(crop_id),
         {:ok, farm} <- fetch_farm(owner) do
      inv = Inventory.load(farm)

      if Inventory.get(inv, crop_id) > 0 do
        inv = inv |> Inventory.sub(crop_id, 1) |> Inventory.add("coins", crop.crop_price)
        save(farm, inv, Inventory.load_brewery(farm))
      else
        {:error, "no crop to sell"}
      end
    else
      nil -> {:error, "unknown crop"}
      {:error, reason} -> {:error, reason}
    end
  end

  @doc "Drinks one potion, granting its timed effect."
  @spec use_potion(String.t(), String.t()) :: {:ok, map()} | {:error, String.t()}
  def use_potion(owner, potion_id) do
    with %{} = potion <- Brewery.potion(potion_id),
         {:ok, farm} <- fetch_farm(owner) do
      inv = Inventory.load(farm)

      if Inventory.potion(inv, potion_id) > 0 do
        brewery = grant_effect(Inventory.load_brewery(farm), potion)
        save(farm, Inventory.add_potion(inv, potion_id, -1), brewery)
      else
        {:error, "you have no such potion"}
      end
    else
      nil -> {:error, "unknown potion"}
      {:error, reason} -> {:error, reason}
    end
  end

  defp grant_effect(brewery, potion) do
    now = now_ms()
    effects = brewery["effects"] || %{}

    effects =
      effects
      |> Brewery.prune_effects(now)
      |> Map.put(potion.effect, now + potion.duration_ms)

    Map.put(brewery, "effects", effects)
  end

  defp spend(owner, cost, fun) do
    with {:ok, farm} <- fetch_farm(owner) do
      inv = Inventory.load(farm)

      if Inventory.get(inv, "coins") >= cost do
        save(farm, fun.(Inventory.sub(inv, "coins", cost)), Inventory.load_brewery(farm))
      else
        {:error, "not enough coins"}
      end
    end
  end

  defp save(farm, inv, brewery) do
    farm
    |> Ecto.Changeset.change(Map.merge(Inventory.attrs(inv), %{brewery: brewery}))
    |> Repo.update!()

    FarmStore.broadcast_change(farm.owner)
    {:ok, FarmStore.view(farm.owner)}
  end

  defp fetch_farm(owner) do
    case Repo.get(FarmRecord, owner) do
      nil -> {:error, "farm not found"}
      farm -> {:ok, farm}
    end
  end

  defp valid_quantity(q) when is_integer(q) and q in 1..@max_quantity, do: {:ok, q}
  defp valid_quantity(_q), do: {:error, "invalid quantity"}

  defp now_ms, do: System.system_time(:millisecond)
end
