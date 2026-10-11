# arcade

Multi-game **human vs bot** centre. Bun monorepo with clean-architecture API, pluggable engines, shared auth, cross-game scoreboard, admin popularity insights, and OpenObserve logs/metrics/traces.

Repo: [fireweave-HQ-Demo/arcade](https://github.com/fireweave-HQ-Demo/arcade)

## Commands

| Env | Start | Stop | URL |
|-----|-------|------|-----|
| **dev (hot reload)** | `bun start` | `bun stop` | **UI** http://localhost:5173 · API :3000 |
| **dev (all-in-Docker)** | `bun start:docker` | `bun stop:docker` | **UI** http://localhost:5173 · API :3000 (live sync) |
| **dev (baked image)** | `bun start:docker:baked` | `bun stop:docker:baked` | http://localhost:3000 (no live sync) |
| **prod** | `bun start:prod` | `bun stop:prod` | http://localhost:80 |

Local `bun start` runs **Postgres in Docker** and host **Bun `--watch`** (API + `packages/*`) + **Vite HMR** (UI). Edit files under `apps/` or `packages/` and they sync at runtime — no image rebuild.

`bun start:docker` runs API + Web **inside** containers with the repo bind-mounted. API restarts via a short poll (Docker Desktop / macOS often misses inotify); Vite uses polling HMR. Prefer `bun start` on the host when you can — it’s faster.

## Layout

```
apps/api                      clean-architecture Bun API
apps/web                      React game centre
  src/games                   boards + move animations
packages/game-core            GameEngine port
packages/engines/src/games    one file per game
packages/shared               DTOs / AppError
docker/                       Dockerfile + compose.yml / compose.dev.yml / compose.prod.yml
scripts/                      dev.sh, dev-stop.sh, prod-start.sh, prod-stop.sh, deploy-prod.sh
.github/workflows             EC2 deploy on push to main
```

## Games (17)

Each game has a lobby description, on-board rules, and a bot. Placing, dropping, and flipping animate on the board.

- Tic-Tac-Toe, Misère Tic-Tac-Toe, Wild Tic-Tac-Toe
- Connect Four, Connect Three, Drop Three, Power Four
- Gomoku, Order & Chaos, SOS
- Reversi, Hexapawn, Mancala, Dots & Boxes
- Nim, Subtract a Square, Memory

## Auth & admin

- Cookie sessions (30 days)
- Login UI has **player** and **admin portal** modes
- Default admin: `admin` / `admin` → `/admin`
- Admin portal: game popularity, favoured game, top players, recent matches
- **OpenObserve**: metrics catalog and action list; **inject triad** sends a log, metrics, and span for an action; **verify pipeline** checks that logs, metrics, and traces round-trip

## Observability

| Signal | Stream / name |
|--------|----------------|
| Logs | `arcade_logs` |
| Metrics | `arcade_http_*`, `arcade_events`, `arcade_matches_total` |
| Traces | `arcade_traces` |

```bash
curl -s http://localhost:3000/api/observability/verify | jq
```

## Deploy (EC2)

Push to `main` runs `.github/workflows/deploy.yml`, which SSHs to EC2 and runs `scripts/deploy-prod.sh` (fingerprint skip-build, port 80).

| Item | Value |
|------|--------|
| Host | `54.147.34.187` |
| App dir | `~/arcade` |
| URL | http://54.147.34.187 |

Security group: TCP **22** (GitHub Actions) and **80** (app).
