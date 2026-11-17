defmodule Grange.BankInterestTest do
  @moduledoc false
  use ExUnit.Case, async: true

  alias Grange.BankInterest

  @day 86_400_000

  test "the daily rate climbs with the balance and caps at 10%" do
    assert BankInterest.rate(0) == 0
    assert BankInterest.rate(50) == 1
    assert BankInterest.rate(100) == 2
    assert BankInterest.rate(499) == 2
    assert BankInterest.rate(500) == 4
    assert BankInterest.rate(2_000) == 7
    assert BankInterest.rate(9_999) == 7
    assert BankInterest.rate(10_000) == 10
    assert BankInterest.rate(5_000_000) == BankInterest.max_rate()
  end

  test "next_tier reports the step above and stops at the cap" do
    assert BankInterest.next_tier(0) == %{min_balance: 100, rate: 2}
    assert BankInterest.next_tier(1_000) == %{min_balance: 2_000, rate: 7}
    assert BankInterest.next_tier(10_000) == nil
  end

  test "a fresh account starts its clock without back-dating interest" do
    assert BankInterest.accrue(500, nil, 42_000, @day) == {500, 42_000}
  end

  test "no interest is paid until a whole day has elapsed" do
    assert BankInterest.accrue(1_000, 0, @day - 1, @day) == {1_000, 0}
    assert BankInterest.accrue(1_000, 0, 0, @day) == {1_000, 0}
  end

  test "one day compounds at the balance's tier" do
    assert BankInterest.accrue(1_000, 0, @day, @day) == {1_040, @day}
  end

  test "idle days compound and can push the balance into a richer tier" do
    # $19.90 sits in the 4% tier; after one day it crosses into 7% and keeps going.
    assert BankInterest.accrue(1_990, 0, 2 * @day, @day) == {2_213, 2 * @day}
  end

  test "an empty account earns nothing but still advances its clock" do
    assert BankInterest.accrue(0, 0, 5 * @day, @day) == {0, 5 * @day}
  end

  test "a clock that moved backwards never pays interest" do
    assert BankInterest.accrue(1_000, 2 * @day, @day, @day) == {1_000, 2 * @day}
  end
end
