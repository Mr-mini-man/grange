import Config

config :grange, GrangeWeb.Endpoint,
  http: [ip: {127, 0, 0, 1}, port: String.to_integer(System.get_env("PORT") || "3200")],
  check_origin: false,
  debug_errors: true,
  server: true

config :grange, enable_test_routes: true
config :logger, level: :info

config :grange, Grange.Repo,
  database: Path.expand("../priv/grange_dev.sqlite3", __DIR__),
  # SQLite takes one writer at a time, so a single connection keeps mutations
  # serialized (as the old GenServers did) and avoids first-boot lock races.
  pool_size: 1,
  journal_mode: :wal,
  busy_timeout: 5_000
