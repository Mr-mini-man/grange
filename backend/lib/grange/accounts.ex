defmodule Grange.Accounts do
  @moduledoc """
  Accounts and sessions, persisted in the database.

  Validation messages match the previous in-memory implementation so the SPA
  and tests see the same contract. Session tokens are handed to the client as
  opaque strings; only a SHA-256 hash is stored, so a database leak cannot be
  replayed.
  """

  import Ecto.Query

  alias Grange.{Repo, Session, User}

  @username_re ~r/^[a-zA-Z0-9_-]{3,32}$/
  @email_re ~r/^[^\s@]+@[^\s@]+\.[^\s@]+$/
  @min_password 8
  @token_bytes 32
  @ttl_seconds 30 * 24 * 60 * 60
  @lobby_topic "lobby"

  @spec register(map()) :: {:ok, User.t()} | {:error, String.t()}
  def register(attrs) do
    username = attrs |> fetch(:username) |> String.trim()
    email = attrs |> fetch(:email) |> String.trim() |> String.downcase()
    password = fetch(attrs, :password)

    with :ok <- validate_username(username),
         :ok <- validate_email(email),
         :ok <- validate_password(password),
         :ok <- ensure_unique(username, email) do
      insert_user(username, email, password)
    end
  end

  @spec authenticate(String.t(), String.t()) :: {:ok, User.t()} | {:error, String.t()}
  def authenticate(username, password) do
    case Repo.get_by(User, username: username) do
      nil ->
        # Hash anyway so a missing account takes the same time as a wrong password.
        _ = hash(password)
        {:error, "invalid username or password"}

      %User{} = user ->
        if Argon2.verify_pass(password, user.password_hash) do
          {:ok, user}
        else
          {:error, "invalid username or password"}
        end
    end
  end

  @spec create_session(String.t()) :: String.t()
  def create_session(user_id) do
    token = :crypto.strong_rand_bytes(@token_bytes) |> Base.url_encode64(padding: false)

    %Session{
      token_hash: hash_token(token),
      user_id: user_id,
      expires_at: DateTime.add(DateTime.utc_now(), @ttl_seconds, :second)
    }
    |> Repo.insert!()

    token
  end

  @spec resolve_token(String.t() | nil) :: {:ok, User.t()} | :error
  def resolve_token(token) when token in [nil, ""], do: :error

  def resolve_token(token) do
    case Repo.get(Session, hash_token(token)) do
      nil -> :error
      session -> resolve_session(session)
    end
  end

  @spec destroy_session(String.t() | nil) :: :ok
  def destroy_session(token) when token in [nil, ""], do: :ok

  def destroy_session(token) do
    Repo.delete_all(from(s in Session, where: s.token_hash == ^hash_token(token)))
    :ok
  end

  @spec list_users() :: [User.t()]
  def list_users, do: Repo.all(from(u in User, order_by: u.username))

  @spec apply_balance_delta(String.t(), integer()) ::
          {:ok, non_neg_integer()} | {:error, String.t()}
  def apply_balance_delta(user_id, delta) when is_integer(delta) do
    case Repo.get(User, user_id) do
      nil ->
        {:error, "unknown user"}

      %User{} = user ->
        # Spend/earn delta, clamped at zero so a balance can never go negative.
        balance = max(0, user.balance + delta)
        user |> Ecto.Changeset.change(balance: balance) |> Repo.update!()
        {:ok, balance}
    end
  end

  def apply_balance_delta(_user_id, _delta), do: {:error, "delta must be an integer"}

  @spec reset() :: :ok
  def reset do
    Repo.delete_all(Session)
    Repo.delete_all(User)
    :ok
  end

  defp resolve_session(session) do
    if DateTime.compare(DateTime.utc_now(), session.expires_at) == :lt do
      case Repo.get(User, session.user_id) do
        nil -> :error
        user -> {:ok, user}
      end
    else
      Repo.delete(session)
      :error
    end
  end

  defp insert_user(username, email, password) do
    attrs = %{username: username, email: email, password_hash: hash(password)}

    case %User{id: User.id()} |> User.changeset(attrs) |> Repo.insert() do
      {:ok, user} ->
        broadcast_players()
        {:ok, user}

      {:error, changeset} ->
        {:error, error_message(changeset)}
    end
  end

  defp error_message(changeset) do
    changeset.errors
    |> Enum.map_join(", ", fn {_field, {message, _opts}} -> message end)
  end

  defp ensure_unique(username, email) do
    cond do
      Repo.exists?(from(u in User, where: u.username == ^username)) ->
        {:error, "that username is taken"}

      Repo.exists?(from(u in User, where: u.email == ^email)) ->
        {:error, "that email is already registered"}

      true ->
        :ok
    end
  end

  defp validate_username(username) do
    if Regex.match?(@username_re, username) do
      :ok
    else
      {:error, "username must be 3-32 characters (letters, numbers, _ or -)"}
    end
  end

  defp validate_email(email) do
    if Regex.match?(@email_re, email) and byte_size(email) <= 254 do
      :ok
    else
      {:error, "a valid email address is required"}
    end
  end

  defp validate_password(password) do
    if String.length(password) >= @min_password do
      :ok
    else
      {:error, "password must be at least #{@min_password} characters"}
    end
  end

  defp fetch(attrs, key) when is_map(attrs) do
    Map.get(attrs, to_string(key)) || Map.get(attrs, key) || ""
  end

  defp hash(password), do: Argon2.hash_pwd_salt(to_string(password), hash_opts())

  # Read from app config instead of Mix.env() so releases (where Mix is not
  # available at runtime) don't crash on register/login.
  defp hash_opts do
    Application.get_env(:grange, :argon2_opts, [])
  end

  defp hash_token(token), do: :crypto.hash(:sha256, token) |> Base.encode16(case: :lower)

  defp broadcast_players do
    players = list_users() |> Enum.map(&%{name: &1.username})
    GrangeWeb.Endpoint.broadcast(@lobby_topic, "players", %{players: players})
  end
end
