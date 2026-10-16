defmodule GrangeWeb.Endpoint do
  @moduledoc false

  use Phoenix.Endpoint, otp_app: :grange

  @session_options [
    store: :cookie,
    key: "_grange_key",
    signing_salt: "grange-session",
    same_site: "Lax",
    http_only: true
  ]

  # The SPA talks to the server over this socket. Identity is carried in the
  # connect params (see `UserSocket`), so no session/cookie connect_info.
  socket("/socket", GrangeWeb.UserSocket,
    websocket: true,
    longpoll: false
  )

  # Built frontend assets (vite build output lives in priv/static).
  plug(Plug.Static, at: "/", from: :grange, gzip: false)

  plug(Plug.RequestId)
  plug(Plug.Telemetry, event_prefix: [:phoenix, :endpoint])

  plug(Plug.Parsers,
    parsers: [:urlencoded, :multipart, :json],
    pass: ["*/*"],
    json_decoder: Jason
  )

  plug(Plug.MethodOverride)
  plug(Plug.Head)
  plug(Plug.Session, @session_options)
  plug(GrangeWeb.Router)
end
