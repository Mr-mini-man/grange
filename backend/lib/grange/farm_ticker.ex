defmodule Grange.FarmTicker do
  @moduledoc """
  Periodically advances watered tiles to ready and notifies their visitors.

  A single timer drives every farm. `FarmStore.tick/1` broadcasts only the
  farms that actually changed, so idle farms cost nothing.
  """

  use GenServer

  alias Grange.FarmStore

  @interval_ms 1_000

  def start_link(opts \\ []), do: GenServer.start_link(__MODULE__, opts, name: __MODULE__)

  @impl true
  def init(opts) do
    interval = Keyword.get(opts, :interval_ms, @interval_ms)
    schedule(interval)
    {:ok, %{interval: interval}}
  end

  @impl true
  def handle_info(:tick, %{interval: interval} = state) do
    FarmStore.tick()
    schedule(interval)
    {:noreply, state}
  end

  defp schedule(interval), do: Process.send_after(self(), :tick, interval)
end
