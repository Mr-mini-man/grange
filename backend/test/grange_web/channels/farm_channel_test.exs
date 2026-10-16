defmodule GrangeWeb.FarmChannelTest do
  @moduledoc false
  use GrangeWeb.ChannelCase

  alias Grange.{Accounts, Farm, FarmStore}
  alias GrangeWeb.ChannelCase, as: Helper

  setup do
    Accounts.reset()
    FarmStore.reset()
    :ok
  end

  defp signed_socket(username) do
    user = Helper.register_user(username)
    socket(GrangeWeb.UserSocket, user.id, %{user: user})
  end

  test "joining a farm replies with the farm" do
    FarmStore.ensure("Alice")

    assert {:ok, reply, _socket} =
             signed_socket("Alice")
             |> subscribe_and_join(GrangeWeb.FarmChannel, "farm:Alice")

    assert reply.farm.owner == "Alice"
    assert reply.farm.tiles == []
  end

  test "the owner can till and the change is broadcast" do
    FarmStore.ensure("Alice")

    {:ok, _reply, socket} =
      signed_socket("Alice") |> subscribe_and_join(GrangeWeb.FarmChannel, "farm:Alice")

    ref = push(socket, "farmAction", %{"action" => %{"kind" => "till", "x" => 1, "y" => 1}})
    assert_reply(ref, :ok)
    assert_broadcast("farmUpdate", %{farm: %{tiles: [%{state: :tilled}]}})
  end

  test "an illegal action is rejected" do
    FarmStore.ensure("Alice")

    {:ok, _reply, socket} =
      signed_socket("Alice") |> subscribe_and_join(GrangeWeb.FarmChannel, "farm:Alice")

    ref = push(socket, "farmAction", %{"action" => %{"kind" => "harvest", "x" => 0, "y" => 0}})
    assert_reply(ref, :error, reply)
    assert reply.error == "no tilled tile here"
  end

  test "a visitor joins read-only and cannot act" do
    FarmStore.ensure("Alice")

    {:ok, _reply, socket} =
      signed_socket("Bob") |> subscribe_and_join(GrangeWeb.FarmChannel, "farm:Alice")

    ref = push(socket, "farmAction", %{"action" => %{"kind" => "till", "x" => 0, "y" => 0}})
    assert_reply(ref, :error, reply)
    assert reply.error == "not your farm"
  end

  test "the owner can sell tomatoes and the change is broadcast" do
    FarmStore.ensure("Alice")
    FarmStore.action("Alice", %{"kind" => "till", "x" => 1, "y" => 1})
    FarmStore.action("Alice", %{"kind" => "plant", "x" => 1, "y" => 1})
    FarmStore.action("Alice", %{"kind" => "water", "x" => 1, "y" => 1})

    future = System.system_time(:millisecond) + Farm.grow_ms() + 60_000
    FarmStore.tick(future)
    FarmStore.action("Alice", %{"kind" => "harvest", "x" => 1, "y" => 1})

    {:ok, _reply, socket} =
      signed_socket("Alice") |> subscribe_and_join(GrangeWeb.FarmChannel, "farm:Alice")

    ref = push(socket, "sellTomatoes", %{"count" => 1})
    assert_reply(ref, :ok)
    remaining = Farm.harvest_yield() - 1
    assert_broadcast("farmUpdate", %{farm: %{tomatoes: ^remaining}})
  end

  test "a visitor cannot sell tomatoes" do
    FarmStore.ensure("Alice")

    {:ok, _reply, socket} =
      signed_socket("Bob") |> subscribe_and_join(GrangeWeb.FarmChannel, "farm:Alice")

    ref = push(socket, "sellTomatoes", %{"count" => 1})
    assert_reply(ref, :error, reply)
    assert reply.error == "not your farm"
  end

  test "a signed-out socket cannot act" do
    FarmStore.ensure("Alice")

    {:ok, _reply, socket} =
      socket(GrangeWeb.UserSocket)
      |> subscribe_and_join(GrangeWeb.FarmChannel, "farm:Alice")

    ref = push(socket, "farmAction", %{"action" => %{"kind" => "till", "x" => 0, "y" => 0}})
    assert_reply(ref, :error, reply)
    assert reply.error == "not logged in"
  end

  test "joining a missing farm fails" do
    assert {:error, %{error: "Farm not found"}} =
             signed_socket("Bob")
             |> subscribe_and_join(GrangeWeb.FarmChannel, "farm:Nobody")
  end

  test "UserSocket.connect resolves the token param" do
    user = Helper.register_user("Alice")
    token = Accounts.create_session(user.id)

    assert {:ok, connected} =
             GrangeWeb.UserSocket.connect(%{"token" => token}, socket(GrangeWeb.UserSocket), %{})

    assert connected.assigns.user.id == user.id
  end

  test "the owner can buy a seed over the channel" do
    FarmStore.ensure("Alice")

    {:ok, _reply, socket} =
      signed_socket("Alice") |> subscribe_and_join(GrangeWeb.FarmChannel, "farm:Alice")

    ref = push(socket, "buySeed", %{"crop" => "wheat", "quantity" => 2})
    assert_reply(ref, :ok)
    assert_broadcast("farmUpdate", %{farm: %{inventory: %{"wheatSeed" => 2}}})
  end

  test "malformed brewery payloads are rejected, not trusted" do
    FarmStore.ensure("Alice")

    {:ok, _reply, socket} =
      signed_socket("Alice") |> subscribe_and_join(GrangeWeb.FarmChannel, "farm:Alice")

    ref = push(socket, "buySeed", %{"crop" => "wheat", "quantity" => "many"})
    assert_reply(ref, :error, reply)
    assert reply.error == "invalid quantity"

    ref = push(socket, "buySeed", %{})
    assert_reply(ref, :error, reply)
    assert reply.error == "unknown seed"

    ref = push(socket, "brew", %{"potion" => 123})
    assert_reply(ref, :error, reply)
    assert reply.error == "unknown potion"

    ref = push(socket, "totallyUnknown", %{})
    assert_reply(ref, :error, reply)
    assert reply.error == "unknown event"
  end

  test "a malformed farmAction is rejected without crashing the channel" do
    FarmStore.ensure("Alice")

    {:ok, _reply, socket} =
      signed_socket("Alice") |> subscribe_and_join(GrangeWeb.FarmChannel, "farm:Alice")

    ref = push(socket, "farmAction", %{})
    assert_reply(ref, :error, reply)
    assert reply.error == "invalid action"

    action = %{"kind" => "plant", "x" => 0, "y" => 0, "crop" => 7}
    ref = push(socket, "farmAction", %{"action" => action})
    assert_reply(ref, :error, reply)
    assert reply.error == "invalid action"
  end

  test "a signed-out socket cannot use the brewery" do
    FarmStore.ensure("Alice")

    {:ok, _reply, socket} =
      socket(GrangeWeb.UserSocket)
      |> subscribe_and_join(GrangeWeb.FarmChannel, "farm:Alice")

    ref = push(socket, "buySeed", %{"crop" => "wheat", "quantity" => 1})
    assert_reply(ref, :error, reply)
    assert reply.error == "not logged in"
  end

  test "a visitor cannot use the owner's brewery" do
    FarmStore.ensure("Alice")

    {:ok, _reply, socket} =
      signed_socket("Bob") |> subscribe_and_join(GrangeWeb.FarmChannel, "farm:Alice")

    ref = push(socket, "buildBrewery", %{})
    assert_reply(ref, :error, reply)
    assert reply.error == "not your farm"
  end
end
