defmodule Grange.TrainDepot do
  @moduledoc """
  The train depot catalogue and purchases.

  Upgrades are bought with Grangecoin and persisted on the buyer's farm row, so
  prices are server-authoritative and the browser only renders them. Every
  accepted purchase debits the wallet and raises the engine, adds a cart, or
  upgrades a cart through `Grange.FarmTrain`, then broadcasts the farm.
  """

  alias Grange.{FarmStore, FarmTrain, Repo, User}

  @prices %{
    "train-engine" => 400,
    "train-cart" => 300,
    "train-cart-upgrade" => 250
  }

  @doc "Buy price in Grangecoin for an upgrade id, or nil when it is not sold."
  @spec price(String.t()) :: pos_integer() | nil
  def price(item), do: Map.get(@prices, item)

  @doc "The whole catalogue as `%{item => price}`."
  @spec catalog() :: %{String.t() => pos_integer()}
  def catalog, do: @prices

  @doc "Buys one upgrade, debiting the buyer's balance and updating their train."
  @spec buy(User.t(), String.t()) :: {:ok, map()} | {:error, String.t()}
  def buy(%User{} = user, item) do
    case price(item) do
      nil -> {:error, "unknown item"}
      cost -> purchase(user, item, cost)
    end
  end

  defp purchase(user, item, cost) do
    case Repo.transaction(fn -> apply_upgrade(user, item, cost) end) do
      {:ok, result} ->
        FarmStore.refresh(user.username)
        {:ok, result}

      {:error, :insufficient_funds} ->
        {:error, "insufficient funds"}

      {:error, reason} when is_binary(reason) ->
        {:error, reason}

      {:error, _reason} ->
        {:error, "purchase failed"}
    end
  end

  defp apply_upgrade(user, item, cost) do
    buyer = Repo.get!(User, user.id)

    if buyer.balance < cost do
      Repo.rollback(:insufficient_funds)
    end

    case upgrade(item, user.username) do
      {:ok, :ok} ->
        balance = buyer.balance - cost
        buyer |> Ecto.Changeset.change(balance: balance) |> Repo.update!()
        %{balance: balance, item: item}

      {:error, reason} ->
        Repo.rollback(reason)
    end
  end

  defp upgrade("train-engine", owner), do: FarmTrain.upgrade_engine(owner)
  defp upgrade("train-cart", owner), do: FarmTrain.add_cart(owner)
  defp upgrade("train-cart-upgrade", owner), do: FarmTrain.upgrade_cart(owner)
end
