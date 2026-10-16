defmodule Grange.Session do
  @moduledoc """
  A persisted login session.

  Only the SHA-256 hash of the session token is stored, so a database leak
  cannot be replayed as a valid session.
  """

  use Ecto.Schema

  @primary_key {:token_hash, :string, autogenerate: false}
  schema "sessions" do
    field(:user_id, :string)
    field(:expires_at, :utc_datetime_usec)
    timestamps(type: :utc_datetime_usec, updated_at: false)
  end

  @type t :: %__MODULE__{
          token_hash: String.t(),
          user_id: String.t(),
          expires_at: DateTime.t(),
          inserted_at: DateTime.t() | nil
        }
end
