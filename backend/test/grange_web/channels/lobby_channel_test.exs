defmodule GrangeWeb.LobbyChannelTest do
  @moduledoc false
  use GrangeWeb.ChannelCase

  alias Grange.{Accounts, FarmStore}
  alias GrangeWeb.ChannelCase, as: Helper

  setup do
    Accounts.reset()
    FarmStore.reset()
    :ok
  end

  defp join_lobby(username) do
    user = Helper.register_user(username)

    {:ok, reply, socket} =
      socket(GrangeWeb.UserSocket, user.id, %{user: user})
      |> subscribe_and_join(GrangeWeb.LobbyChannel, "lobby")

    {reply, socket}
  end

  test "join lists players and prepares the user's farm" do
    {reply, _socket} = join_lobby("Alice")

    assert Enum.map(reply.players, & &1.name) == ["Alice"]
    assert Enum.map(reply.farms, & &1.owner) == ["Alice"]
    assert FarmStore.has_farm?("Alice")
  end

  test "registering broadcasts the player list" do
    {_reply, _socket} = join_lobby("Alice")

    {:ok, _user} =
      Accounts.register(%{
        "username" => "Bob",
        "email" => "bob@example.test",
        "password" => "harvest-please"
      })

    assert_broadcast("players", %{players: players})
    assert Enum.any?(players, &(&1.name == "Bob"))
  end

  test "farms returns the current summaries" do
    FarmStore.ensure("Bob")
    {_reply, socket} = join_lobby("Alice")

    ref = push(socket, "farms", %{})
    assert_reply(ref, :ok, reply)
    assert Enum.map(reply.farms, & &1.owner) == ["Alice", "Bob"]
  end
end
