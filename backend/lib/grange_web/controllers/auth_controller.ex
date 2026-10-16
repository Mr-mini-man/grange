defmodule GrangeWeb.AuthController do
  @moduledoc """
  HTTP endpoints for registering, signing in, signing out, and `GET /me`.

  Sessions are carried in a signed, httpOnly cookie. The browser only needs to
  send it back; the client never reads the token directly.
  """

  use Phoenix.Controller, formats: [:json]

  alias Grange.Accounts

  @session_key :user_token

  def register(conn, params) do
    case Accounts.register(params) do
      {:ok, user} ->
        {conn, token} = start_session(conn, user)

        conn
        |> put_status(:created)
        |> json(%{ok: true, user: user, token: token})

      {:error, reason} ->
        conn |> put_status(:bad_request) |> json(%{ok: false, error: reason})
    end
  end

  def login(conn, params) do
    username = params |> Map.get("username", "") |> to_string()
    password = params |> Map.get("password", "") |> to_string()

    case Accounts.authenticate(username, password) do
      {:ok, user} ->
        {conn, token} = start_session(conn, user)
        json(conn, %{ok: true, user: user, token: token})

      {:error, reason} ->
        conn |> put_status(:unauthorized) |> json(%{ok: false, error: reason})
    end
  end

  def logout(conn, _params) do
    Accounts.destroy_session(get_session(conn, @session_key))

    conn
    |> delete_session(@session_key)
    |> json(%{ok: true})
  end

  def me(conn, _params) do
    case current_user(conn) do
      nil ->
        conn |> put_status(:unauthorized) |> json(%{ok: false, error: "not signed in"})

      user ->
        json(conn, %{ok: true, user: user, token: get_session(conn, @session_key)})
    end
  end

  defp start_session(conn, user) do
    token = Accounts.create_session(user.id)
    {put_session(conn, @session_key, token), token}
  end

  defp current_user(conn) do
    case Accounts.resolve_token(get_session(conn, @session_key)) do
      {:ok, user} -> user
      :error -> nil
    end
  end
end
