defmodule GrangeWeb.TrainController do
  @moduledoc "Handles train-depot upgrades for the signed-in account."

  use Phoenix.Controller, formats: [:json]

  alias Grange.{Accounts, FarmStore, TrainDepot}

  @session_key :user_token

  def buy(conn, params) do
    case current_user(conn) do
      nil ->
        unauthorized(conn)

      user ->
        FarmStore.ensure(user.username)
        buy(conn, user, Map.get(params, "item"))
    end
  end

  defp buy(conn, user, item) do
    case TrainDepot.buy(user, item) do
      {:ok, result} ->
        json(conn, Map.put(result, :ok, true))

      {:error, reason} ->
        conn |> put_status(:bad_request) |> json(%{ok: false, error: reason})
    end
  end

  defp unauthorized(conn) do
    conn |> put_status(:unauthorized) |> json(%{ok: false, error: "not signed in"})
  end

  defp current_user(conn) do
    case Accounts.resolve_token(get_session(conn, @session_key)) do
      {:ok, user} -> user
      :error -> nil
    end
  end
end
