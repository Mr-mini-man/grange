defmodule Grange.Repo do
  @moduledoc """
  The Ecto repository backing all persistent game state.

  The app uses SQLite (via `ecto_sqlite3`), which keeps the single-host Mix
  release free of any external database service.
  """

  use Ecto.Repo,
    otp_app: :grange,
    adapter: Ecto.Adapters.SQLite3
end
