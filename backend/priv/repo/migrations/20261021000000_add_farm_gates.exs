defmodule Grange.Repo.Migrations.AddFarmGates do
  use Ecto.Migration

  def change do
    alter table(:farms) do
      add(:gate_count, :integer, null: false, default: 2)
    end

    create table(:farm_gates) do
      add(:owner, references(:farms, column: :owner, type: :string, on_delete: :delete_all),
        null: false
      )

      add(:x, :integer, null: false)
      add(:y, :integer, null: false)
      add(:direction, :string, null: false, default: "horizontal")
      add(:open, :boolean, null: false, default: false)
    end

    create(unique_index(:farm_gates, [:owner, :x, :y]))
  end
end
