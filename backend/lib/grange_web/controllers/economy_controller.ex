defmodule GrangeWeb.EconomyController do
  @moduledoc """
  Persists Grangecoin balance changes for the signed-in account.

  The server is the source of truth for a player's balance; the client sends a
  signed delta after each spend or earn so the total belongs to the account
  rather than the browser session.
  """

  use Phoenix.Controller, formats: [:json]

  alias Grange.Accounts

  @session_key :user_token

  def transaction(conn, params) do
    case current_user(conn) do
      nil ->
        conn |> put_status(:unauthorized) |> json(%{ok: false, error: "not signed in"})

      user ->
        apply_delta(conn, user, params)
    end
  end

  defp apply_delta(conn, user, params) do
    case Accounts.apply_balance_delta(user.id, Map.get(params, "delta")) do
      {:ok, balance} ->
        json(conn, %{ok: true, balance: balance})

      {:error, reason} ->
        conn |> put_status(:bad_request) |> json(%{ok: false, error: reason})
    end
  end

  defp current_user(conn) do
    case Accounts.resolve_token(get_session(conn, @session_key)) do
      {:ok, user} -> user
      :error -> nil
    end
  end
end
