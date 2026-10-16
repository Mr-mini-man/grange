# Plan: Update PR #26 (Move to Elixir / Phoenix backend) onto current main

PR: https://github.com/psu-cs4140/grange/pull/26
Head: `origin` (NatTuck/grange) `main`
Base: `upstream` (psu-cs4140/grange) `main`

## Goal

Bring the Phoenix backend migration up to date with upstream `main` by merging
`upstream/main` into the PR branch and reconciling the two architectures:

- Phoenix replaces the Node/Express/Socket.IO server.
- Keep `main`'s argon2 auth/sessions and the Excalibur farm map.
- Make the farm server-authoritative over Phoenix channels.
- Drop the card game and the PR's simple farm UI.

Merge (not rebase) so the fork's published `main` is not rewritten.

## Baseline

- Merge base: `a24c413` (#23)
- PR head: `bef1f518` (fork `main`)
- Upstream tip: `276fe1b`
- 15 conflicting files at merge time.

Upstream `main` gained: Excalibur farm map (#25), plant interaction (#27),
farm map on homepage (#29), wireframe notes (#28), argon2 auth/sessions (#24),
player movement (#31).

The PR gained: minimal farming game, Phoenix backend + channels, strict Credo,
Elixir-release deploys.

## Phase 0 - Setup

1. `git remote rename origin upstream` and `git remote rename fork origin` so
   `origin` = NatTuck and `upstream` = psu-cs4140.
2. Work on a branch based on the PR head (`origin/main`), e.g. `update/pr-26`.
3. `git merge upstream/main`, resolve conflicts, commit, push to `origin main`.

## Phase 1 - Conflict resolution + prune

Because the card game and Node server are dropped, most modify/delete
conflicts resolve to "delete".

- Delete: `server/index.ts`, `server/sockets.ts`, `src/routes/Game.tsx`,
  `e2e/dashboard.spec.ts`, `e2e/lobby.spec.ts`.
- `package.json`: PR scripts (`setup`, `dev`, `dev:backend`, `dev:web`,
  `build`, `test`, `test:backend`, `test:e2e`, `lint`, `lint:backend`,
  `sanity`, `check`, `format`, `start`); keep upstream frontend deps
  (`excalibur`, tailwind, react-router, zustand); add PR deps (`phoenix`,
  `@types/phoenix`, `concurrently`); drop `express`, `socket.io`,
  `socket.io-client`, `vite-express`, `vite-node`, `@types/express`, JS
  `argon2`, and card-game deps (`konva`, `react-konva`, `react-spring`,
  `@react-spring/konva`). Regenerate `pnpm-lock.yaml` with `pnpm install`.
- `.gitignore`: union of upstream `.env*`/sqlite and PR Elixir ignores.
- `deploy/grange.service`: PR release-based unit.
- `e2e/helpers.ts`: upstream auth-aware helpers, env-based `BASE`,
  Phoenix `/api/reset`.
- `src/App.tsx`: upstream `RequireAuth` routes minus `/games/:uuid`; `/`
  Login, `/world` own farm, `/dashboard` lobby, optional `/farms/:owner`.
- `src/routes/Login.tsx`: upstream register/sign-in UI (testids
  `toggle-mode`, `username`, `email`, `password`, `auth-error`).
- `src/routes/Dashboard.tsx`: rewrite as lobby (players + farms + visit).
- `src/socket.ts`: rewrite as Phoenix `Socket`/channels client.
- `src/store.ts`: merge `user`/session with farm state (tiles + inventory).

Keep upstream: `public/assets/farm/*`, `src/world/*`, `src/auth.ts`,
`src/useSession.ts`, `src/routes/RequireAuth.tsx`, `notes/*`.

Delete PR simple-farm/card-game pieces: `src/routes/Farm.tsx`,
`src/components/*`, `src/boardLayout.ts`, `src/theme.ts`, `shared/cards.ts`,
all `server/*`, `tsconfig.server.json`; strip card/plant types from
`shared/types.ts` (keep tile types from upstream `shared/farm.ts`).

Keep PR: `biome.json`, `mise.toml`, `scripts/*`, `design/tech.md`.

## Phase 2 - Port auth to Phoenix

- `mix.exs`: add `argon2_elixir` (NIF).
- `Grange.Accounts` GenServer mirroring upstream `InMemoryUserStore`
  (users + sessions, sha256 token hash, 30-day TTL).
- `GrangeWeb.AuthController` at `/api/auth`: `POST /register`, `POST /login`,
  `POST /logout`, `GET /me`; same validation and generic error/401 behavior.
- Cookie `grange.sid` (http_only, same_site Lax, secure in prod).
- `UserSocket.connect/3`: resolve session from handshake cookies via
  `connect_info`; channels trust `socket.assigns`, never client names.

## Phase 3 - Port tile farm to Phoenix (server-authoritative)

- `Grange.Farm`: grid 15, grow 10s, yield 3, states
  `tilled|planted|watered|ready`, tools hoe/seed/bucket/scythe, inventory.
- `Grange.FarmStore` GenServer: get_tile, get_player_tiles, get_inventory,
  till_ground, plant_seed, water_tile, harvest_crop, tick_farm, clear.
- `Grange.FarmTicker` GenServer (1s) broadcasts `farmUpdate` for ready tiles.
- `FarmChannel` (`farm:<owner>`): owner actions from session identity,
  visitors read-only, broadcast `farmUpdate`.
- `LobbyChannel`: players + farm summaries.
- Port `server/farm.test.ts` to `backend/test/grange/farm_test.exs`, plus
  auth tests.

## Phase 4 - Rewire frontend to Phoenix

- `src/auth.ts`: unchanged `/api/auth/*` calls; `rebindAuth()` reconnects
  the Phoenix socket.
- `src/socket.ts`: join `lobby`; handle `players`/`farms`; `farm:<owner>`
  handles `farmUpdate`; expose `requestFarms`, `emitFarmAction`,
  `emitVisitFarm`, `emitLeaveFarm`.
- `src/world/FarmMapScene.ts` + `InputManager.ts`: render tiles from the
  store, emit farm actions, tool HUD, ready tiles via `farmUpdate`.
- `vite.config.ts`: PR proxy (`/api`, `/socket` -> :4000) and build to
  `backend/priv/static`.

## Phase 5 - CI / deploy / packaging

- `ci.yml`: PR's Elixir setup + Playwright + `pnpm check` + `pnpm test:e2e`.
- `deploy.yml`, `etandsdeploy.yml`, `deploy.sh`: PR Elixir-release flows.
- `playwright.config.ts`: PR Phoenix `webServer`, `MIX_ENV=dev`,
  `enable_test_routes` so `/api/reset` exists.
- Refresh `pnpm-lock.yaml`.

## Phase 6 - Verify

- `pnpm install && pnpm lint && pnpm test && pnpm lint:backend &&
  pnpm test:backend && pnpm build && pnpm test:e2e`.
- Smoke: register -> `/world` Excalibur loads; till/plant/water/harvest
  persist through Phoenix; session survives reload; logout closes routes;
  lobby lists farms.
- Push to `origin main` and confirm PR #26 is mergeable.

## Risks

- Argon2 NIF adds a compile step on CI and the release host.
- Session -> channel identity needs `connect_info` cookie access and
  `check_origin` for the dev Vite proxy.
- e2e selectors depend on upstream testids in `Login.tsx`.
- If `upstream/main` advances again, repeat the merge.
