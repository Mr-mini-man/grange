import Config

if config_env() == :prod do
  secret_key_base =
    System.get_env("SECRET_KEY_BASE") ||
      raise "environment variable SECRET_KEY_BASE is missing"

  port = String.to_integer(System.get_env("PORT") || "3200")
  host = System.fetch_env!("PHX_HOST")

  config :grange, GrangeWeb.Endpoint,
    url: [host: host, scheme: "https", port: 443],
    check_origin: ["https://#{host}"],
    http: [ip: {0, 0, 0, 0, 0, 0, 0, 0}, port: port],
    secret_key_base: secret_key_base

  # The SQLite file lives next to the release and is created on first boot.
  database_path =
    System.get_env("DATABASE_PATH") ||
      Path.join([System.get_env("RELEASE_ROOT") || ".", "data", "grange.sqlite3"])

  File.mkdir_p!(Path.dirname(database_path))

  config :grange, Grange.Repo,
    database: database_path,
    pool_size: String.to_integer(System.get_env("POOL_SIZE") || "1"),
    journal_mode: :wal,
    busy_timeout: 5_000

  # Real mail in production; the console adapter (and its token-logging dev
  # mailbox route) never ships here.
  config :grange, :mailer, Grange.Mailer.Mailjet
  # Links in email must point at the public site, not the local listener.
  config :grange, :app_url, System.get_env("APP_URL") || "https://#{host}"
end

# Development defaults to the console mailer so verification/reset links can be
# read back from GET /api/auth/mailbox (the e2e tests rely on this). When the
# Mailjet credentials below are present, real mail is sent instead, so the
# production provider can be exercised locally before a deploy. Set
# GRANGE_MAILER to "console" or "mailjet" to override that choice.
if config_env() == :dev do
  mailjet_configured? =
    Enum.all?(["MAILJET_API_KEY", "MAILJET_API_SECRET", "MAIL_FROM_EMAIL"], fn var ->
      System.get_env(var) not in [nil, ""]
    end)

  mailer =
    case System.get_env("GRANGE_MAILER") do
      "mailjet" -> Grange.Mailer.Mailjet
      "console" -> Grange.Mailer.Console
      _ -> if mailjet_configured?, do: Grange.Mailer.Mailjet, else: Grange.Mailer.Console
    end

  config :grange, :mailer, mailer
end
