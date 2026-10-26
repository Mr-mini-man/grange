defmodule Grange.FarmGate do
  @moduledoc "One placed gate on a player's farm."
  use Ecto.Schema

  schema "farm_gates" do
    field(:owner, :string)
    field(:x, :integer)
    field(:y, :integer)
    field(:direction, :string, default: "horizontal")
    field(:open, :boolean, default: false)
  end
end
