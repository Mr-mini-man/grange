defmodule Grange.BankInterest do
  @moduledoc """
  Tiered daily interest for money left in the savings bank.

  The daily rate rises with the deposited balance and is capped at 10%. Interest
  compounds once per whole `:bank_day_ms` (24 hours by default). Accrual is lazy:
  `accrue/4` advances the balance by every whole day that has elapsed since the
  account's `last_at` and stores the leftover time, so no per-user timer is
  needed — a player earns for time away even if they never open the bank.
  """

  # Ascending minimum balance -> whole percent per day. The highest matching
  # tier wins, so a bigger deposit always earns at least as much as a smaller one.
  @tiers [{0, 1}, {100, 2}, {500, 4}, {2_000, 7}, {10_000, 10}]
  @max_rate 10
  @default_day_ms 86_400_000

  @doc "Whole-percent daily rate for a savings balance, capped at #{@max_rate}%."
  @spec rate(integer()) :: non_neg_integer()
  def rate(balance) when is_integer(balance) and balance > 0 do
    @tiers
    |> Enum.filter(fn {min, _rate} -> balance >= min end)
    |> List.last()
    |> elem(1)
  end

  def rate(_balance), do: 0

  @doc "The daily rate ceiling, as a whole percent."
  @spec max_rate() :: pos_integer()
  def max_rate, do: @max_rate

  @doc "The `{minimum_balance, daily_percent}` tiers, lowest first."
  @spec tiers() :: [{non_neg_integer(), pos_integer()}]
  def tiers, do: @tiers

  @doc "Milliseconds in one interest day."
  @spec day_ms() :: pos_integer()
  def day_ms, do: Application.get_env(:grange, :bank_day_ms, @default_day_ms)

  @doc "The next tier above `balance`, or nil once the cap is reached."
  @spec next_tier(integer()) :: %{min_balance: non_neg_integer(), rate: pos_integer()} | nil
  def next_tier(balance) do
    case Enum.find(@tiers, fn {min, _rate} -> min > balance end) do
      nil -> nil
      {min, rate} -> %{min_balance: min, rate: rate}
    end
  end

  @doc """
  Compounds every whole day elapsed between `last_at` and `now`.

  A nil `last_at` (fresh account) starts the clock without earning, so a new
  deposit never back-dates interest. Returns `{balance, last_at}`, where the new
  timestamp drops the whole days consumed and keeps the current-day fraction.
  """
  @spec accrue(integer(), integer() | nil, integer(), pos_integer()) :: {integer(), integer()}
  def accrue(balance, last_at, now, day_ms \\ day_ms())

  def accrue(balance, nil, now, _day_ms), do: {balance, now}

  def accrue(balance, last_at, now, day_ms) when day_ms > 0 do
    days = max(div(now - last_at, day_ms), 0)
    {compound(balance, days), last_at + days * day_ms}
  end

  defp compound(balance, days) do
    Enum.reduce(1..days//1, balance, fn _day, acc ->
      acc + div(acc * rate(acc), 100)
    end)
  end
end
