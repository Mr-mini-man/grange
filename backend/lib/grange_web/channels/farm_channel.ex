defmodule GrangeWeb.FarmChannel do
  @moduledoc """
  A single farm's room: read-only for visitors, actions for the owner.

  Replaces the socket.io `visitFarm` / `leaveFarm` / `farmAction` events and
  the `farmUpdate` broadcast. Identity comes from the session, never the client.
  Market, brewery, bar, and prop actions share the same owner-only boundary.
  """

  use Phoenix.Channel

  alias Grange.{BreweryStore, FarmStore}

  @impl true
  def join("farm:" <> owner, _payload, socket) do
    ensure_owner_farm(owner, socket)

    if FarmStore.has_farm?(owner) do
      GrangeWeb.Endpoint.subscribe("farm:" <> owner)
      {:ok, %{farm: FarmStore.view(owner)}, assign(socket, :owner, owner)}
    else
      {:error, %{error: "Farm not found"}}
    end
  end

  defp ensure_owner_farm(owner, socket) do
    case socket.assigns[:user] do
      %{username: ^owner} -> FarmStore.ensure(owner)
      _ -> nil
    end
  end

  @impl true
  def handle_in("farmAction", payload, socket) do
    authorize(socket, &act(socket, &1, field(payload, "action")))
  end

  def handle_in("farmPropAction", payload, socket) do
    authorize(socket, &prop_act(socket, &1, field(payload, "action")))
  end

  def handle_in("sellTomatoes", payload, socket) do
    authorize(socket, &sell(socket, &1, field(payload, "count")))
  end

  def handle_in("buySeed", payload, socket) do
    authorize(
      socket,
      &respond(socket, BreweryStore.buy_seed(&1, field(payload, "crop"), quantity(payload)))
    )
  end

  def handle_in("buyMaterial", payload, socket) do
    authorize(
      socket,
      &respond(
        socket,
        BreweryStore.buy_material(&1, field(payload, "material"), quantity(payload))
      )
    )
  end

  def handle_in("buildBrewery", _payload, socket) do
    authorize(socket, &respond(socket, BreweryStore.build_brewery(&1)))
  end

  def handle_in("brew", payload, socket) do
    authorize(socket, &respond(socket, BreweryStore.brew(&1, field(payload, "potion"))))
  end

  def handle_in("sellPotion", payload, socket) do
    authorize(socket, &respond(socket, BreweryStore.sell_potion(&1, field(payload, "potion"))))
  end

  def handle_in("sellCrop", payload, socket) do
    authorize(socket, &respond(socket, BreweryStore.sell_crop(&1, field(payload, "crop"))))
  end

  def handle_in("usePotion", payload, socket) do
    authorize(socket, &respond(socket, BreweryStore.use_potion(&1, field(payload, "potion"))))
  end

  def handle_in(_event, _payload, socket) do
    {:reply, {:error, %{error: "unknown event"}}, socket}
  end

  @impl true
  def handle_out(event, payload, socket) do
    push(socket, event, payload)
    {:noreply, socket}
  end

  defp authorize(socket, handler) do
    owner = socket.assigns[:owner]
    user = socket.assigns[:user]

    cond do
      is_nil(user) -> {:reply, {:error, %{error: "not logged in"}}, socket}
      user.username != owner -> {:reply, {:error, %{error: "not your farm"}}, socket}
      true -> handler.(owner)
    end
  end

  defp act(socket, owner, action), do: respond(socket, FarmStore.action(owner, action))

  defp prop_act(socket, owner, action), do: respond(socket, FarmStore.prop_action(owner, action))

  defp sell(socket, owner, count), do: respond(socket, FarmStore.sell_tomatoes(owner, count))

  defp respond(socket, {:ok, _farm}), do: {:reply, :ok, socket}
  defp respond(socket, {:error, reason}), do: {:reply, {:error, %{error: reason}}, socket}

  defp field(payload, key) when is_map(payload), do: Map.get(payload, key)
  defp field(_payload, _key), do: nil

  defp quantity(payload) when is_map(payload), do: Map.get(payload, "quantity", 1)
  defp quantity(_payload), do: 1
end
