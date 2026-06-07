# E2EE Real-Time Communication System

End-to-end encrypted chat and voice/video (1-1) — microservice stack.

## Prerequisites

- Docker Desktop (Compose v2)
- Git

## Local env (before first `docker compose up`)

```powershell
# From repo root — creates .env files only if missing (does not overwrite)
.\scripts\setup-env.ps1
```

Ensure `api-service/.env` uses host **`postgres`** in `DATABASE_URL` (not `localhost`) when running inside Compose.

After each `git pull`, compare your `.env` files with the matching `.env.example` and add any new keys (e.g. `JWT_ACCESS_SECRET`, `ALLOW_DEV_*` in `realtime-service/.env`). `JWT_ACCESS_SECRET` must match between `api-service` and `realtime-service`.

## Quick start (local dev)

```powershell
docker compose up --build
```

Open **http://localhost** (gateway). API: `http://localhost/api/v1/...`, Socket.IO: `http://localhost/socket.io/`.

Compose loads `compose.yaml` + `compose.override.yaml` (bind-mount + `npm run dev`)

## Production-like (local or VM)

```powershell
copy .env.prod.example .env.prod
# Edit .env.prod — set POSTGRES_PASSWORD and secrets

docker compose -f compose.yaml --env-file .env.prod up --build -d
```

Uses `BUILD_TARGET=runtime` and `NGINX_CONF=nginx.conf`. Build frontend `dist/` before prod nginx static works (`npm run build` in `frontend/` once Vite project exists).

## Environment files

| File | Purpose |
|------|---------|
| `.env.example` | Dev defaults → copy to `.env` |
| `.env.prod.example` | Prod template → copy to `.env.prod` |
| `api-service/.env.example` | API service |
| `realtime-service/.env.example` | Realtime service |
| `frontend/.env.example` | Vite (`VITE_*`) |

Root `.env` controls `BUILD_TARGET`, `NGINX_CONF`, and Postgres vars for Compose.

## Service boot contract (owners)

Before full stack healthchecks pass, each owner must deliver:

| Owner | Required in repo | Compose expects |
|-------|----------------|-----------------|
| **API** | `package.json`, `package-lock.json`, scripts `dev` / `build` / `start`, `GET /health`, `GET /ready`, listen `PORT`, `DATABASE_URL` with host `postgres` | Image target `development` or `runtime`, entry `dist/index.js` |
| **Realtime** | Same script pattern, `GET /health`, Socket.IO on HTTP server, port `4000` | `depends_on` api-service healthy |
| **Frontend** | Vite app, `npm run dev` on `0.0.0.0:5173`, `npm run build` → `dist/`, `VITE_API_BASE_URL=/api/v1`, `VITE_SOCKET_BASE_URL=` (empty) | Gateway dev proxies `/` → `frontend:5173` |

DevOps scope: compose, gateway, nginx, Dockerfiles, env templates — not application UI or business logic.

Minimal boot scaffold (health + Socket.IO listen + Vite placeholder) is in place; owners add business routes, socket auth, and UI.

## Architecture (local)

```
Browser :80 → gateway (nginx)
  /           → frontend:5173 (dev) or static dist (prod)
  /api/*      → api-service:3000
  /socket.io/ → realtime-service:4000
api-service → postgres:5432
```

## Verify infra only (no app code)

```powershell
docker compose config
docker compose up -d postgres
docker compose exec postgres pg_isready -U e2ee_user -d e2ee_app
```

## Docs

See [`docs/`](docs/) — read in order:

1. [`00-glossary-and-naming.md`](docs/00-glossary-and-naming.md) — glossary and naming conventions
2. [`01-architecture.md`](docs/01-architecture.md) — system architecture
3. [`02-api.md`](docs/02-api.md) — REST API contract (FROZEN v1.0.0)
4. [`03-events.md`](docs/03-events.md) — Socket.IO events (FROZEN v1.0.0)
5. [`09-team-raci.md`](docs/09-team-raci.md) — RACI, contract freeze rules
6. [`07-deployment-cicd.md`](docs/07-deployment-cicd.md) — deployment and CI/CD
