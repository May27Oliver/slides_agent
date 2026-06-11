# HTML Slides Agent

**English** · [繁體中文](README.zh-TW.md)

Turn raw text (notes, transcripts, reports) into a **previewable, downloadable HTML slide deck** — locally, with an LLM-assisted but deterministic-rendered pipeline.

Paste or upload content, pick a presentation style, and the app plans the deck, designs a visual system, and renders a self-contained 16:9 HTML deck you can preview in-app and download as a single file.

---

## Features

- **Source → deck pipeline**: semantic segmentation → deck-outline planning → design planning → HTML rendering → validation.
- **LLM-assisted, deterministic-rendered**: the LLM handles language/structure/design _selection_; the final HTML is produced by a deterministic, reference-grade template renderer (fast, free, consistent, always valid).
- **UIUX Pro Max design system**: curated palettes + font pairings + a concrete style kit (type scale, motion, effects) selected from the deck brief. See [`docs/design.md`](docs/design.md).
- **Manual theme browsing** (feature 011): browse the full theme catalogue (font / palette / style swatches) and hand-pick one at generation or edit time — deterministic, zero extra LLM calls.
- **Deck library & persistence** (feature 006): generated decks are saved per-account and listed in "My Decks"; the structured `SlideDeck` is the source of truth and HTML is a derived cache.
- **In-app deck editing** (feature 010): restructure a saved deck (reorder / edit / remove slides, re-theme), deterministically re-rendered and persisted as a new revision under optimistic concurrency.
- **Chart editing in the editor** (feature 014): switch a chart's visual (pie/line/bar/metric card/table, validators still gate), remove/add charts from source intents or manual input, and edit data points — user-provided values are mirrored, disclosed (「本圖表含使用者提供的數據點（n/m）」), and never reuse source-fact provenance.
- **Async preview jobs**: submit a job, poll for progress, get the result — with timeouts, failure reporting, and a cancellable polling UI.
- **Self-contained output**: one HTML file, inline CSS/JS, keyboard navigation, the only external resource being Google Fonts.
- **Source-faithful**: validators guard slide order, content fidelity, and number fidelity; nothing fabricates facts.
- **Works without an API key**: with `OPENAI_API_KEY` empty, the pipeline still runs through deterministic fallbacks.

---

## Architecture

A pnpm monorepo with a clean domain core and thin app shells.

| Package              | Name                      | Role                                                                                                             |
| -------------------- | ------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `packages/domain`    | `@slides-agent/domain`    | Pure domain logic: segmentation, deck/outline planning, design system, rendering, preview-job lifecycle. No I/O. |
| `packages/contracts` | `@slides-agent/contracts` | Shared request/response contracts + runtime validators.                                                          |
| `apps/api`           | `@slides-agent/api`       | NestJS backend: REST endpoints, LLM adapters (ports), preview-job store/runner.                                  |
| `apps/web`           | `@slides-agent/web`       | React + Vite frontend: input form, style presets + theme picker, my-decks library, in-app deck editor, job polling, preview. |

### Generation pipeline

```
sourceContent + deckBrief
        │
        ▼ content_planning   semantic segmentation (LLM, with deterministic fallback)
        ▼ deck_planning      deck outline + LLM refinement (source-fidelity guards)
        ▼ design_planning    UIUX Pro Max design system + curated style-kit selection
        ▼ html_generation    deterministic reference-grade template renderer
        ▼ html_validation    self-contained / order / content / design checks
        ▼
   PreviewArtifact (self-contained HTML)
```

LLM calls live behind ports (adapter pattern); when no API key is configured, each stage falls back deterministically. The HTML stage is **template-primary**: the deterministic renderer is the source of the final HTML, so output is fast, consistent, and always passes validation.

---

## Prerequisites

- Node.js `20.19.5`
- pnpm `10.30.3` (this is a **pnpm** project — do not use `yarn`/`npm`)

> The repo pins `packageManager: pnpm@10.30.3`. If you have Corepack, `corepack enable` will use the right version automatically.

## Setup

```bash
cp .env.example .env      # then fill in OPENAI_API_KEY (optional)
pnpm install
```

## Configuration

All LLM settings are **backend-only** and never exposed to the frontend or API responses. Set them in the root `.env`:

| Variable                          | Default                 | Description                                                                                                                       |
| --------------------------------- | ----------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| `PORT`                            | `3000`                  | API server port.                                                                                                                  |
| `LLM_PROVIDER`                    | `openai`                | LLM provider (only `openai` supported).                                                                                           |
| `OPENAI_API_KEY`                  | —                       | OpenAI key. **Empty → deterministic fallbacks** (app still works).                                                                |
| `LLM_MODEL`                       | —                       | Default model for all LLM operations.                                                                                             |
| `SEMANTIC_SEGMENTATION_MODEL`     | `LLM_MODEL`             | Optional per-operation model override.                                                                                            |
| `DESIGN_PLANNING_MODEL`           | `LLM_MODEL`             | Optional per-operation model override.                                                                                            |
| `LLM_MAX_REPAIR_ATTEMPTS`         | `1`                     | Bounded repair attempts for validation-backed LLM outputs.                                                                        |
| `PREVIEW_RATE_LIMIT_MAX`          | `5`                     | Max preview POSTs per window per client IP.                                                                                       |
| `PREVIEW_RATE_LIMIT_WINDOW_MS`    | `60000`                 | Rate-limit window in ms.                                                                                                          |
| `REDIS_URL`                       | —                       | **Required** (feature 004). Redis for the preview-job queue; API/worker fail fast without it.                                     |
| `AUTH_JWT_SECRET`                 | —                       | **Required** (feature 005). Secret for signing login JWTs; API fails fast without it.                                             |
| `AUTH_JWT_EXPIRES_IN`             | `30d`                   | JWT lifetime.                                                                                                                     |
| `AUTH_ACCOUNTS`                   | `[]`                    | JSON allowlist `[{ id, username, displayName, passwordHash, active }]`. Generate `passwordHash` with `pnpm auth:hash <password>`. |
| `AUTH_LOGIN_RATE_LIMIT_MAX`       | `10`                    | Max `POST /api/auth/login` per window per IP.                                                                                     |
| `AUTH_LOGIN_RATE_LIMIT_WINDOW_MS` | `60000`                 | Login rate-limit window in ms.                                                                                                    |
| `VITE_API_PROXY_TARGET`           | `http://localhost:3000` | (web) API proxy target for the dev server.                                                                                        |

### Auth (feature 005)

Login is required to use the app and the generation endpoints. Accounts are an
owner-configured allowlist (no public signup). To add one:

```bash
pnpm auth:hash 'the-password'    # prints a scrypt passwordHash
# add to AUTH_ACCOUNTS in .env:
# [{ "id":"user_owner","username":"owner@example.com","displayName":"Owner","passwordHash":"<paste>","active":true }]
```

Auth endpoints: `POST /api/auth/login`, `GET /api/auth/me`, `POST /api/auth/logout`.
The JWT is stored in the browser's `localStorage`; the preview endpoints require
`Authorization: Bearer <jwt>`.

---

## Running locally

Preview generation runs as async jobs on a **Redis + BullMQ** queue, consumed by
a separate **worker** process — so the API stays responsive while the LLM works.
Redis is **required**; start it first (locally with Homebrew):

```bash
brew install redis        # once
brew services start redis # background service on 127.0.0.1:6379
# or run it in the foreground: redis-server
```

> No Redis locally? Any reachable instance works — point `REDIS_URL` at it. If you
> prefer a throwaway container: `docker run --rm -p 6379:6379 redis:7`.

With Redis running, one command splits the current iTerm2 tab into three panes —
API + worker + web (it warns if Redis is unreachable):

```bash
pnpm dev:iterm
```

Or run each process manually:

```bash
# Backend API (watch mode, restarts on change) → http://localhost:3000
pnpm --filter @slides-agent/api dev

# Preview-job worker (separate, non-HTTP process; consumes the queue)
pnpm --filter @slides-agent/api worker:dev

# Frontend (Vite HMR) → http://localhost:5173
pnpm --filter @slides-agent/web dev -- --host localhost --port 5173
```

Open <http://localhost:5173>. The web dev server proxies `/api/*` to the API (override with `VITE_API_PROXY_TARGET`).

### Smoke check

```bash
curl -I http://localhost:5173/                                 # frontend up
curl -i http://localhost:3000/api/slides/preview-jobs/example   # → 404 PREVIEW_JOB_UNAVAILABLE
```

### Database console

Two ways to inspect the persisted accounts/decks from the terminal (both need only `DATABASE_URL`):

```bash
pnpm db:repl     # NestJS REPL — interactive terminal console
pnpm db:studio   # Drizzle Studio — visual browser at local.drizzle.studio
```

`db:repl` boots a DB-only NestJS context (no Redis/worker — just `DATABASE_URL`). Inside it:

```js
> help()                                          // list the REPL commands
> debug()                                          // modules / providers
> methods(DrizzleDeckStore)                        // a provider's methods
> await get(DbService).pool.query('select id, title, status from decks')  // raw SQL
> await get(DrizzleDeckStore).listByAccount('user_owner')                 // typed store
> await get(DbUserAccountStore).findByUsername('owner@example.com')
```

> `db:studio` edits write immediately with no undo — be careful against real data.

### Adding a DB column (migrations)

The schema is **code-first** in `apps/api/src/infra/db/schema.ts`. To add or change a
column, edit that file, then generate and apply a migration:

```bash
# 1. Edit the table in apps/api/src/infra/db/schema.ts
#    e.g. add `summary: text("summary")` to the decks table.

pnpm db:generate   # drizzle-kit diffs schema.ts → new SQL in src/infra/db/migrations
pnpm db:migrate    # applies pending migrations to DATABASE_URL
```

- **Review the generated SQL** before applying — open the new file under
  `apps/api/src/infra/db/migrations/` and check the diff. drizzle-kit names it
  automatically (e.g. `0001_*.sql`).
- Migrations are **never run on API/worker boot** — you must run `pnpm db:migrate`
  explicitly (also in deploy). The generated SQL and the `meta/` snapshot are
  committed to git, so every environment applies the same migrations in order.
- Verify with `pnpm db:studio` or `psql "$DATABASE_URL" -c '\d decks'`.

> Destructive changes (drop/rename column) can lose data — drizzle-kit may prompt;
> review the SQL and back up real data first.

### Theme catalogue (feature 007)

Design styles are **data, not code**: the builtin theme catalogue lives in the
`themes` table (three selection axes — `font` / `palette` / `style` — keyed by a
`kind` column). At generation time `selectTheme` reads the catalogue from the DB
and composes a `DesignStyleKit` deterministically, on both the LLM-success and
fallback paths.

```bash
pnpm db:convert-seeds                       # ui-ux-pro-max CSVs → src/infra/db/seeds/*.json
pnpm db:seed                                # idempotent upsert (also seeds accounts)
pnpm --filter @slides-agent/api preview:themes   # render all full styles → apps/api/preview/themes/
```

- The CSV→seed converter is non-destructive: hand-authored full `style` tokens
  (A-grade + the B-grade upgrades) live in `src/infra/db/seeds/authored-style-kits.ts`
  and are merged over the generated skeleton. Re-running `db:convert-seeds` is safe.
- Seeding is **all-or-nothing**: a kind-aware validator rejects the whole batch
  (zero writes) if any row is invalid, so the catalogue never half-loads.
- Current catalogue: **220 rows** — font 57, palette 96, style 67 (20 `full` + 47 `raw`).

---

## API

Interactive OpenAPI docs (Swagger UI): **`/api/docs`** (raw spec at `/api/docs-json`). The schema is built from the shared `@slides-agent/contracts` package.

Base path: `/api/slides`

| Method | Path                   | Description                                                                |
| ------ | ---------------------- | -------------------------------------------------------------------------- |
| `POST` | `/preview`             | Synchronous preview generation. Returns the full artifact.                 |
| `POST` | `/preview-jobs`        | Enqueue an async preview job → `202` with `jobId` + `statusUrl`.           |
| `GET`  | `/preview-jobs/:jobId` | Poll job status/result (`404 PREVIEW_JOB_UNAVAILABLE` if unknown/expired). |

Request body (both POSTs):

```jsonc
{
  "sourceContent": "…your notes/transcript…", // required, ≤ 50,000 chars
  "deckBrief": {
    "purpose": "面試", // required
    "audience": "長官", // required
    "styleDirection": "專業商務", // optional, steers the design kit
    "chartEmphasis": "…", // optional
    "segmentationGuidance": "…", // optional
    "language": "zh-TW" // optional
  }
}
```

The two POST endpoints share a per-IP rate-limit budget. Source/brief fields are length-capped.

### Account endpoints

All require `Authorization: Bearer <jwt>` (auth itself excepted).

| Method | Path                        | Description                                                                                |
| ------ | --------------------------- | ----------------------------------------------------------------------------------------- |
| `POST` | `/api/auth/login`           | Log in against the account allowlist → JWT (feature 005).                                  |
| `GET`  | `/api/auth/me`              | Current session identity.                                                                  |
| `POST` | `/api/auth/logout`          | End the session.                                                                           |
| `GET`  | `/api/decks`               | List the signed-in account's saved decks (feature 006).                                    |
| `GET`  | `/api/decks/:id`           | Deck detail (current revision).                                                            |
| `POST` | `/api/decks/:id/revisions` | Apply a structural/text edit → new `origin="edit"` revision; deterministic re-render (010). |
| `GET`  | `/api/themes`              | Browse the theme catalogue grouped by `font` / `palette` / `style` (feature 011).          |

---

## Deployment (Docker Compose, feature 012)

For single-host production deployment, the repo ships a Docker Compose stack
(`nginx` edge + `api` + `worker` + one-shot `migrate` job + `postgres` + `redis`).
One command brings it up:

```bash
cp .env.production.example .env   # then fill POSTGRES_* / AUTH_* / ALLOWED_ORIGIN
docker compose up -d --build
```

migrate→seed runs automatically and gates `api`/`worker`; the only app change vs
dev is a public liveness probe `GET /api/health`. Full guide (required env,
healthcheck observation, end-to-end smoke, `down -v` risk, manual rerun):
[`specs/012-docker-compose-deploy/quickstart.md`](specs/012-docker-compose-deploy/quickstart.md).

---

## Testing & verification

### Unit / integration tests (vitest)

```bash
pnpm test                                   # all packages, in order: domain → contracts → api → web
pnpm test:domain                            # one package (also: test:contracts / test:api / test:web)
pnpm --filter @slides-agent/domain test     # equivalent per-package form
pnpm --filter @slides-agent/web test:e2e    # Playwright E2E (web)
```

Type-check a package with its `build` script (no-emit `tsc`), e.g. `pnpm --filter @slides-agent/domain build`.

### Verification harnesses (`apps/api`)

Deterministic dev scripts — **no front-end, LLM, or DB needed**. They read the committed theme seeds and write previewable HTML under `apps/api/preview/` (git-ignored).

| Script                 | Purpose                                                                                                                                                                                                                          | Run                                                                                                               |
| ---------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| `preview:deck`         | Run a markdown file through the deterministic deck pipeline; prints each chart's planned → concrete visual (bar/line/pie/…) and the selected theme, then writes `preview/deck.html`. Verifies **your content** charts correctly. | `pnpm --filter @slides-agent/api preview:deck [file.md] [styleDirection]`<br>(defaults to `sample-deck-input.md`) |
| `preview:chart-matrix` | Renders every supported chart visual × every enabled style (20 × 7) to `preview/chart-matrix/index.html`; **fails** on any unintended fallback or external resource. Catches a chart breaking under some style.                  | `pnpm --filter @slides-agent/api preview:chart-matrix`                                                            |
| `preview:themes`       | Renders the theme gallery across all enabled styles — eyeball the design system.                                                                                                                                                 | `pnpm --filter @slides-agent/api preview:themes`                                                                  |

Examples:

```bash
# verify the sample deck (region → bar, quarter → line, device → pie)
pnpm --filter @slides-agent/api preview:deck

# verify preset differentiation (e.g. a tech style direction)
pnpm --filter @slides-agent/api preview:deck sample-deck-input.md "tech startup developer 科技"
```

> After editing theme seed JSON (`apps/api/src/infra/db/seeds/*.json`), run `pnpm db:seed` for the change to take effect in the running app and in `preview:deck`'s theme selection.

---

## Project structure

```
apps/
  api/        NestJS backend (controllers, LLM adapters, preview-job/deck/theme stores)
  web/        React + Vite frontend (form, theme picker, my-decks, deck editor, polling, preview)
packages/
  domain/     pure domain logic (segmentation, deck/design/render, deck-edit, review, preview-job)
  contracts/  shared request/response contracts + validators
docs/
  design.md   design-system architecture + how to add new design skills
specs/        feature specs 001 → 011 (spec-kit)
```

---

## Notes

- **No key, still works**: every LLM stage has a deterministic fallback; output quality degrades gracefully, never breaks.
- **Self-contained output**: generated HTML loads only Google Fonts externally; everything else is inline. The preview runs in a sandboxed iframe.
- **Design extensibility**: to add another design skill (palettes/fonts/style), see the provider/registry guide in [`docs/design.md`](docs/design.md).
