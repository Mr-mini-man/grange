defmodule Grange.Repo.Migrations.AddFarmTrain do
  @moduledoc """
  Adds the train to every farm: an engine upgrade tier, the coupled carts, and
  the cargo loaded into them.

  `train_carts` maps a 1-based coupling slot to its cart tier (an empty map
  means the default single tier-1 cart). `train_cargo` maps a slot to its
  `%{item => count}` cargo. Both default to empty so existing farms start with
  the starter train.
  """

  use Ecto.Migration

  def change do
    alter table(:farms) do
      add(:train_engine, :integer, null: false, default: 0)
      add(:train_carts, :map, null: false, default: %{})
      add(:train_cargo, :map, null: false, default: %{})
    end
  end
end
