defmodule Grange.Bank do
  @moduledoc """
  Atomic transfers between a player's wallet and savings account.

  Every operation accrues the tiered daily interest (`Grange.BankInterest`)
  first, so a player earns for the whole time their money sat in the bank even
  if they only visit occasionally.
  """

  alias Grange.{BankInterest, Repo, User}

  @doc "Moves `amount` between the wallet and savings after applying interest."
  @spec transfer(String.t(), String.t(), integer()) :: {:ok, map()} | {:error, String.t()}
  def transfer(user_id, direction, amount)
      when direction in ["deposit", "withdraw"] and is_integer(amount) and amount > 0 do
    run(fn ->
      user = accrue!(user_id)
      {wallet, savings} = settle(user, direction, amount)
      persist(user, wallet, savings)
      summary(wallet, savings)
    end)
  end

  def transfer(_user_id, _direction, _amount), do: {:error, "enter a positive whole amount"}

  @doc "Returns wallet and interest-bearing savings, applying interest first."
  @spec view(String.t()) :: {:ok, map()} | {:error, String.t()}
  def view(user_id) do
    run(fn ->
      user = accrue!(user_id)

      summary(user.balance, user.bank_balance)
      |> Map.put(:next_tier, BankInterest.next_tier(user.bank_balance))
    end)
  end

  defp run(fun) do
    case Repo.transaction(fun) do
      {:ok, result} -> {:ok, result}
      {:error, reason} -> {:error, reason}
    end
  end

  defp accrue!(user_id) do
    user = Repo.get(User, user_id) || Repo.rollback("unknown user")
    now = System.system_time(:millisecond)
    {savings, at} = BankInterest.accrue(user.bank_balance, user.bank_interest_at, now)

    if savings == user.bank_balance and at == user.bank_interest_at do
      user
    else
      user
      |> Ecto.Changeset.change(bank_balance: savings, bank_interest_at: at)
      |> Repo.update!()
    end
  end

  defp settle(user, "deposit", amount) do
    if user.balance < amount, do: Repo.rollback("insufficient wallet funds")
    {user.balance - amount, user.bank_balance + amount}
  end

  defp settle(user, "withdraw", amount) do
    if user.bank_balance < amount, do: Repo.rollback("insufficient savings")
    {user.balance + amount, user.bank_balance - amount}
  end

  defp persist(user, wallet, savings) do
    user
    |> Ecto.Changeset.change(balance: wallet, bank_balance: savings)
    |> Repo.update!()
  end

  defp summary(wallet, savings) do
    %{balance: wallet, bank_balance: savings, interest_rate: BankInterest.rate(savings)}
  end
end
