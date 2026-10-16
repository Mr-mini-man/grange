# SQLite persistence plan

Status: proposed. Scope: move server state (accounts/sessions and farms/tiles)
from in-memory maps to SQLite via **Ecto + ecto_sqlite3**, using conventional
Phoenix layout. Public channel/API contracts stay the same so the frontend is
untouched.

## Design decisions (locked)

1. **Use `user_id`/`farm_id` foreign keys** and Ecto/Phoenix naming throughout.
   No username-keyed rows.
2. **Real wall-clock time for events.** Sessions and crop deadlines are
   `:utc_datetime_usec` / `DateTime`, not integers or monotonic time.
3. **Drop `Grange.Accounts` the GenServer.** Accounts becomes a normal Ecto
   context that hits `Repo` directly.
4. **Keep `Grange.FarmStore` as a write-behind cache.** Farm/tile state is
   authoritative in memory and flushed to SQLite periodically, so busy gameplay
   (every hoe/plant/water) does not become a write per action.

## Contexts, schemas, and naming

Follow standard Phoenix conventions: contexts own schemas and queries.

```
lib/grange/repo.ex                 Grange.Repo
lib/grange/accounts.ex             Grange.Accounts        (Ecto context, no GenServer)
lib/grange/accounts/user.ex        Grange.Accounts.User   (schema)
lib/grange/accounts/session.ex     Grange.Accounts.Session(schema)
lib/grange/farms.ex                Grange.Farms           (Ecto context + pure transitions)
lib/grange/farms/farm.ex           Grange.Farms.Farm      (schema)
lib/grange/farms/tile.ex           Grange.Farms.Tile      (schema)
lib/grange/farm_store.ex           Grange.FarmStore       (cache GenServer, writes via Farms)
lib/grange/farm_ticker.ex          Grange.FarmTicker      (drives tick + flush)
```

`Grange.User` / `Grange.Farm` / the old pure helpers are folded into the
contexts and deleted. Schemas are internal; they are not serialized directly to
clients (views build plain maps, as today).

## Dependencies

Add to `backend/mix.exs`:

```elixir
{:ecto_sql, "~> 3.11"},
{:ecto_sqlite3, "~> 0.17"}
```

Add `ecto_repos: [Grange.Repo]` to `project/0`.

## Repo and configuration

```elixir
defmodule Grange.Repo do
  use Ecto.Repo, otp_app: :grange, adapter: Ecto.Adapters.SQLite3
end
```

```elixir
# config/dev.exs
config :grange, Grange.Repo,
  database: Path.expand("../grange_dev.db", __DIR__),
  journal_mode: :wal,
  busy_timeout: 5000,
  foreign_keys: :on,
  pool_size: 5

# config/test.exs
config :grange, Grange.Repo,
  database: Path.expand("../grange_test.db", __DIR__),
  journal_mode: :wal,
  busy_timeout: 5000,
  foreign_keys: :on,
  pool_size: 1
```

`runtime.exs` (prod): `database:` from `DATABASE_PATH`, defaulting to
`Path.expand("grange.db")` (systemd `WorkingDirectory=/home/grange/grange` is
writable). WAL + `busy_timeout` for concurrent reads; `foreign_keys: :on`
(SQLite defaults it off) is set per connection.

## Schema

### accounts_users

| column | type | notes |
| --- | --- | --- |
| id | `binary_id` PK | `@primary_key {:id, :binary_id, autogenerate: true}` |
| username | string | unique index, not null, trimmed |
| email | string | unique index, not null, downcased |
| password_hash | string | not null |
| timestamps | utc_datetime_usec | |

Changeset validation replaces the hand-rolled regex checks; uniqueness relies on
the DB index, with constraint errors mapped to the existing user-facing strings
in the context.

### accounts_sessions

| column | type | notes |
| --- | --- | --- |
| token_hash | string PK | SHA-256 hex of the opaque token |
| user_id | `binary_id` FK -> accounts_users | `on_delete: :delete_all` |
| expires_at | utc_datetime_usec | `DateTime.add(DateTime.utc_now(), @ttl, :millisecond)` |
| inserted_at | utc_datetime_usec | |

### farms_farms

| column | type | notes |
| --- | --- | --- |
| id | `binary_id` PK | |
| user_id | `binary_id` FK -> accounts_users | unique index, `on_delete: :delete_all` |
| tomatoes | integer | default 0, not null |
| timestamps | utc_datetime_usec | |

### farms_tiles

| column | type | notes |
| --- | --- | --- |
| id | `binary_id` PK | |
| farm_id | `binary_id` FK -> farms_farms | unique index `[:farm_id, :x, :y]`, `on_delete: :delete_all` |
| x / y | integer | not null |
| state | `Ecto.Enum` (`:tilled :planted :watered :ready`) | stored as string |
| crop | `Ecto.Enum` (`:tomato`) | stored as string |
| planted_at / watered_at / ready_at | utc_datetime_usec null | real time |
| timestamps | utc_datetime_usec | |

## Real-time events

Replace every `System.monotonic_time(:millisecond)` with `DateTime.utc_now()`.
Deadlines are `DateTime.add(now, @grow_ms, :millisecond)`, and "ripened" checks
use `DateTime.compare(now, ready_at) != :lt`. Session `expires_at` is compared
the same way. `Grange.Farms` transition helpers therefore take and return
`DateTime` values; `farm_test.exs` fabricates a future with
`DateTime.add(DateTime.utc_now(), Farm.grow_ms(), :millisecond)`.

Wall clock can jump (NTP/manual): a backwards jump delays ripening/expiry, a
forward jump advances it. That is the accepted trade-off for deadlines that must
outlive the VM.

## Accounts context (no GenServer)

`Grange.Accounts` keeps the same public functions so channels/controllers/tests
are unchanged:

- `register/1` — `%User{} |> User.registration_changeset(attrs) |> Repo.insert()`;
  map the unique-constraint error to the existing strings; broadcast `players`
  from `Repo.all(User)` after success.
- `authenticate/2` — `Repo.get_by(User, username: ...)`; same Argon2 flow,
  including hashing on a missing account to equalize timing.
- `create_session/1` / `destroy_session/1` / `resolve_token/1` — insert/delete/
  fetch `Session` rows; delete on expiry.
- `list_users/0` — `Repo.all(from u in User, order_by: u.username)`.
- `reset/0` — `Repo.delete_all(Session)` then `Repo.delete_all(User)`.

The `Grange.Accounts` child is removed from `Grange.Application`; the context is
called directly. This removes the single global account process and its maps.

## FarmStore as a write-behind cache

`Grange.FarmStore` keeps its current external API — `ensure/1`, `has_farm?/1`,
`view/1`, `summaries/0`, `action/2`, `tick/1`, `reset/0` — and its GenServer, but
the state is no longer the system of record; SQLite is.

State shape:

```elixir
%{
  farms: %{user_id => %Farms.Farm{tiles: [%Tile{}], user: %User{}}},
  dirty: MapSet.t(user_id)
}
```

Behavior:

- **Reads serve the cache.** `view/1` and `summaries/0` never touch the DB on the
  hot path; `summaries/0` reads the preloaded `user.username` for the `owner`
  field. On a cache miss (first `ensure`/`view`/`has_farm?`), load the farm and
  tiles with `Grange.Farms`.
- **Authored actions** apply the pure transition in the cache, mutate the tile
  struct, mark the farm dirty, and broadcast immediately. No DB write per action.
- **Flush happens on the tick** (see below): all dirty farms are persisted in one
  transaction, then the dirty set is cleared.
- **Writes use the context** (`Grange.Farms.persist/1`): upsert the farm's tiles
  with `insert_all(..., on_conflict: :replace, conflict_target: [:farm_id, :x, :y])`
  and update `tomatoes`. Tiles are never deleted (harvest returns to `:tilled`).
- **Durability:** an abrupt VM exit loses at most the unflushed window (≤ tick
  interval, ~1s). Add a best-effort `terminate/2` flush for graceful shutdowns.
  This is the explicit cost of batching writes and is acceptable for a game.

`Grange.FarmTicker` keeps its 1s timer. `tick/1` now: (1) advance watered tiles
whose `ready_at` has passed, (2) flush dirty farms, (3) broadcast only farms that
changed, preserving its current return value (distinct owner usernames).

Single-node assumption: the cache is authoritative, so this design does not
support running multiple app nodes against one DB file. The current deploy is a
single systemd unit, so this is fine; note it if horizontal scaling is ever
wanted.

## Concurrency

- Accounts and farms write different tables, but SQLite still has one writer.
  WAL + `busy_timeout` keeps readers (lobby/farm views) from blocking.
- Batched flush keeps write transactions short and infrequent.
- `FarmStore`'s GenServer serializes gameplay mutations and broadcast ordering,
  as it does today.

## Tests

- Add `Grange.DataCase` with `Ecto.Adapters.SQL.Sandbox`; run migrations once in
  `test_helper.exs`.
- Because `FarmStore` and `FarmTicker` are long-lived app processes, use
  `Sandbox.mode(Grange.Repo, :shared)` and allow the processes
  (`Sandbox.allow/3`) so they see the test connection.
- Tests keep calling `Accounts.reset()` / `FarmStore.reset()` in `setup`
  (`reset` clears both DB rows and the cache); keep `async: false` as today.
- Update the fabricated-future assertion in `farm_store_test.exs:74` to
  `DateTime`.
- The `/api/reset` e2e hook (`health_controller.ex:17`) keeps working; it now
  truncates tables and clears the cache.

## Deploy / release

- Add `Grange.Release.migrate/0`
  (`Ecto.Migrator.with_repo(Grange.Repo, &Ecto.Migrator.run(&1, :up, all: true))`).
- `deploy/deploy.sh`: run `bin/grange eval "Grange.Release.migrate()"` before
  `systemctl --user restart grange`.
- Persist `DATABASE_PATH` in `~/grange.env`; back up with `VACUUM INTO`. Note
  Litestream as an option for continuous replication later.
- ecto_sqlite3 bundles `Exqlite`, so no new system packages; CI already has a C
  toolchain.

## Implementation order

1. Add deps + `Grange.Repo` + config; `mix deps.get`, `mix ecto.create`.
2. Write migrations; `mix ecto.migrate`; add the four schemas + changesets.
3. Build `Grange.Accounts` as a context (no GenServer); delete `Grange.User`;
   remove the `Accounts` child from `Application`; run `accounts_test.exs`.
4. Build `Grange.Farms` with real-time transitions; delete `Grange.Farm`; update
   `farm_test.exs`.
5. Rework `FarmStore` into the cache + flush design; keep its API; run
   `farm_store_test.exs` and channel tests.
6. Add `Grange.Release`, update `deploy.sh`/env for `DATABASE_PATH`; verify a
   release boots and migrates.
7. Update `README` with DB location and `mix ecto.migrate`.
