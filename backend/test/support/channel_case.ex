defmodule GrangeWeb.ChannelCase do
  @moduledoc false

  use ExUnit.CaseTemplate

  using do
    quote do
      import Phoenix.ChannelTest

      @endpoint GrangeWeb.Endpoint
    end
  end

  @doc "Registers a user (and asserts success) for channel tests."
  def register_user(username) do
    {:ok, user} =
      Grange.Accounts.register(%{
        "username" => username,
        "email" => "#{username}@example.test",
        "password" => "harvest-please"
      })

    user
  end
end
