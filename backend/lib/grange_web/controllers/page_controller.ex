defmodule GrangeWeb.PageController do
  @moduledoc "Serves the built SPA shell for client-side routes."

  use Phoenix.Controller, formats: [:html]

  def index(conn, _params) do
    path = Application.app_dir(:grange, "priv/static/index.html")

    if File.exists?(path) do
      conn
      |> put_resp_content_type("text/html")
      |> send_file(200, path)
    else
      send_resp(conn, 404, "Not found")
    end
  end
end
