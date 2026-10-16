defmodule GrangeWeb.FallbackController do
  @moduledoc "Returns a JSON 404 for unmatched /api routes."

  use Phoenix.Controller, formats: [:json]

  def not_found(conn, _params) do
    conn
    |> put_status(:not_found)
    |> json(%{ok: false, error: "not found"})
  end
end
