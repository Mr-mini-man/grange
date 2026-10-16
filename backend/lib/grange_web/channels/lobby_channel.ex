defmodule GrangeWeb.LobbyChannel do
  @moduledoc """
  Lists registered players and every farm summary, broadcasting updates.

  Replaces the socket.io `farms` request and the `players` / `farms` events.
  """

  use Phoenix.Channel

  alias Grange.Accounts
  alias Grange.FarmStore

  @impl true
  def join("lobby", _payload, socket) do
    GrangeWeb.Endpoint.subscribe("lobby")
    ensure_farm(socket)
    {:ok, %{players: players(), farms: FarmStore.summaries()}, socket}
  end

  @impl true
  def handle_in("farms", _payload, socket) do
    {:reply, {:ok, %{farms: FarmStore.summaries()}}, socket}
  end

  @impl true
  def handle_out(event, payload, socket) do
    push(socket, event, payload)
    {:noreply, socket}
  end

  defp ensure_farm(socket) do
    case socket.assigns[:user] do
      %{username: username} -> FarmStore.ensure(username)
      _ -> nil
    end
  end

  defp players do
    Accounts.list_users() |> Enum.map(&%{name: &1.username})
  end
end
