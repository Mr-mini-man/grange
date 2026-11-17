defmodule Grange.Repo.Migrations.AddBankInterest do
  use Ecto.Migration

  def change do
    # Epoch-ms of the last interest compounding; nil until the account first
    # touches the bank, at which point the clock starts without back-interest.
    alter table(:users) do
      add(:bank_interest_at, :integer)
    end
  end
end
