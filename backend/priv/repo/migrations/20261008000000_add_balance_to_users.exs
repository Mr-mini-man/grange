defmodule Grange.Repo.Migrations.AddBalanceToUsers do
  @moduledoc false

  use Ecto.Migration

  def change do
    alter table(:users) do
      add(:balance, :integer, null: false, default: 100)
    end
  end
end
