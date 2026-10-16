defmodule Grange.Repo.Migrations.AddInventoryToFarms do
  @moduledoc false

  use Ecto.Migration

  def change do
    alter table(:farms) do
      add(:inventory, :map)
      add(:brewery, :map)
    end
  end
end
