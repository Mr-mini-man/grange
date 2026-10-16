defmodule Grange.Repo.Migrations.CreateGrangeTables do
  @moduledoc false

  use Ecto.Migration

  def change do
    create table(:users, primary_key: false) do
      add(:id, :string, primary_key: true)
      add(:username, :string, null: false)
      add(:email, :string, null: false)
      add(:password_hash, :string, null: false)
      timestamps(type: :utc_datetime_usec, updated_at: false)
    end

    create(unique_index(:users, [:username], name: :users_username_index))
    create(unique_index(:users, [:email], name: :users_email_index))

    create table(:sessions, primary_key: false) do
      add(:token_hash, :string, primary_key: true)
      add(:user_id, references(:users, type: :string, on_delete: :delete_all), null: false)
      add(:expires_at, :utc_datetime_usec, null: false)
      timestamps(type: :utc_datetime_usec, updated_at: false)
    end

    create(index(:sessions, [:user_id]))

    create table(:farms, primary_key: false) do
      add(:owner, :string, primary_key: true)
      add(:tomatoes, :integer, null: false, default: 0)
      timestamps(type: :utc_datetime_usec)
    end

    create table(:tiles) do
      add(:owner, references(:farms, column: :owner, type: :string, on_delete: :delete_all),
        null: false
      )

      add(:x, :integer, null: false)
      add(:y, :integer, null: false)
      add(:state, :string, null: false, default: "tilled")
      add(:crop, :string, null: false, default: "tomato")
      add(:planted_at, :integer)
      add(:watered_at, :integer)
      add(:ready_at, :integer)
    end

    create(unique_index(:tiles, [:owner, :x, :y]))
  end
end
