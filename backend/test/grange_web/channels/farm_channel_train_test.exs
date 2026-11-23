defmodule GrangeWeb.FarmChannelTrainTest do
  @moduledoc false
  use GrangeWeb.ChannelCase

  import Grange.FarmFixtures

  alias Grange.{Accounts, FarmStore}
  alias GrangeWeb.ChannelCase, as: Helper

  setup do
    Accounts.reset()
    reset_farm_state()
    :ok
  end

  defp signed_socket(username) do
    user = Helper.register_user(username)
    socket(GrangeWeb.UserSocket, user.id, %{user: user})
  end

  test "the owner can load and unload the train's cargo" do
    FarmStore.ensure("Alice")

    {:ok, _reply, socket} =
      signed_socket("Alice") |> subscribe_and_join(GrangeWeb.FarmChannel, "farm:Alice")

    ref =
      push(socket, "trainAction", %{
        "action" => %{"kind" => "deposit", "item" => "wheat", "count" => 3}
      })

    assert_reply(ref, :ok)

    assert_broadcast("farmUpdate", %{
      farm: %{train: %{carts: [%{cargo: %{"wheat" => 3}}]}}
    })

    ref =
      push(socket, "trainAction", %{
        "action" => %{"kind" => "withdraw", "item" => "wheat", "count" => 1, "cart" => 1}
      })

    assert_reply(ref, :ok)
    assert_broadcast("farmUpdate", %{farm: %{train: %{carts: [%{cargo: %{"wheat" => 2}}]}}})
  end

  test "a visitor cannot touch the train's cargo" do
    public_farm("Alice")

    {:ok, _reply, socket} =
      signed_socket("Bob") |> subscribe_and_join(GrangeWeb.FarmChannel, "farm:Alice")

    ref =
      push(socket, "trainAction", %{
        "action" => %{"kind" => "deposit", "item" => "wheat", "count" => 1}
      })

    assert_reply(ref, :error, reply)
    assert reply.error == "not your farm"
  end
end
