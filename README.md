# HTML Slides Agent

**English** · [繁體中文](README.zh-TW.md)

Turn raw text (notes, transcripts, reports) into a **previewable, downloadable HTML slide deck** — locally, with an LLM-assisted but deterministic-rendered pipeline.

Paste or upload content, pick a presentation style, and the app plans the deck, designs a visual system, and renders a self-contained 16:9 HTML deck you can preview in-app and download as a single file.

---

## Features

- **Source → deck pipeline**: semantic segmentation → deck-outline planning → design planning → HTML rendering → validation.
- **LLM-assisted, deterministic-rendered**: the LLM handles language/structure/design *selection*; the final HTML is produced by a deterministic, reference-grade template renderer (fast, free, consistent, always valid).
- **UIUX Pro Max design system**: curated palettes + font pairings + a concrete style kit (type scale, motion, effects) selected from the deck brief. See [`docs/design.md`](docs/design.md).
- **Async preview jobs**: submit a job, poll for progress, get the result — with timeouts, failure reporting, and a cancellable polling UI.
- **Self-contained output**: one HTML file, inline CSS/JS, keyboard navigation, the only external resource being Google Fonts.
- **Source-faithful**: validators guard slide order, content fidelity, and number fidelity; nothing fabricates facts.
- **Works without an API key**: with `OPENAI_API_KEY` empty, the pipeline still runs through deterministic fallbacks.

---

## Architecture

A pnpm monorepo with a clean domain core and thin app shells.

| Package | Name | Role |
|---|---|---|
| `packages/domain` | `@slides-agent/domain` | Pure domain logic: segmentation, deck/outline planning, design system, rendering, preview-job lifecycle. No I/O. |
| `packages/contracts` | `@slides-agent/contracts` | Shared request/response contracts + runtime validators. |
| `apps/api` | `@slides-agent/api` | NestJS backend: REST endpoints, LLM adapters (ports), preview-job store/runner. |
| `apps/web` | `@slides-agent/web` | React + Vite frontend: input form, style presets, job polling, preview. |

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

| Variable | Default | Description |
|---|---|---|
| `PORT` | `3000` | API server port. |
| `LLM_PROVIDER` | `openai` | LLM provider (only `openai` supported). |
| `OPENAI_API_KEY` | — | OpenAI key. **Empty → deterministic fallbacks** (app still works). |
| `LLM_MODEL` | — | Default model for all LLM operations. |
| `SEMANTIC_SEGMENTATION_MODEL` | `LLM_MODEL` | Optional per-operation model override. |
| `DESIGN_PLANNING_MODEL` | `LLM_MODEL` | Optional per-operation model override. |
| `LLM_MAX_REPAIR_ATTEMPTS` | `1` | Bounded repair attempts for validation-backed LLM outputs. |
| `PREVIEW_RATE_LIMIT_MAX` | `5` | Max preview POSTs per window per client IP. |
| `PREVIEW_RATE_LIMIT_WINDOW_MS` | `60000` | Rate-limit window in ms. |
| `VITE_API_PROXY_TARGET` | `http://localhost:3000` | (web) API proxy target for the dev server. |

---

## Running locally

One command (splits the current iTerm2 tab into two panes — API + web):

```bash
pnpm dev:iterm
```

Preview generation runs as async jobs on a **Redis + BullMQ** queue, consumed by
a separate **worker** process — so the API stays responsive while the LLM works.
Redis is **required**; start it first:

```bash
docker run --rm -p 6379:6379 --name slides-redis redis:7
```

Then run each process manually:

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

---

## API

Base path: `/api/slides`

| Method | Path | Description |
|---|---|---|
| `POST` | `/preview` | Synchronous preview generation. Returns the full artifact. |
| `POST` | `/preview-jobs` | Enqueue an async preview job → `202` with `jobId` + `statusUrl`. |
| `GET` | `/preview-jobs/:jobId` | Poll job status/result (`404 PREVIEW_JOB_UNAVAILABLE` if unknown/expired). |

Request body (both POSTs):

```jsonc
{
  "sourceContent": "…your notes/transcript…",   // required, ≤ 50,000 chars
  "deckBrief": {
    "purpose": "面試",                            // required
    "audience": "長官",                           // required
    "styleDirection": "專業商務",                 // optional, steers the design kit
    "chartEmphasis": "…",                         // optional
    "segmentationGuidance": "…",                  // optional
    "language": "zh-TW"                            // optional
  }
}
```

The two POST endpoints share a per-IP rate-limit budget. Source/brief fields are length-capped.

---

## Testing

```bash
pnpm test                                   # all packages (domain, contracts, api, web)
pnpm --filter @slides-agent/domain test     # one package
pnpm --filter @slides-agent/web test:e2e    # Playwright E2E
```

Type-check a package with `pnpm --filter <name> exec tsc --noEmit` (each `build` script is a no-emit type-check).

---

## Project structure

```
apps/
  api/        NestJS backend (controllers, LLM adapters, preview-job store/runner)
  web/        React + Vite frontend (form, style presets, polling, preview)
packages/
  domain/     pure domain logic (segmentation, deck/design/render, preview-job)
  contracts/  shared request/response contracts + validators
docs/
  design.md   design-system architecture + how to add new design skills
specs/        feature specs (003-async-preview-jobs)
```

---

## Notes

- **No key, still works**: every LLM stage has a deterministic fallback; output quality degrades gracefully, never breaks.
- **Self-contained output**: generated HTML loads only Google Fonts externally; everything else is inline. The preview runs in a sandboxed iframe.
- **Design extensibility**: to add another design skill (palettes/fonts/style), see the provider/registry guide in [`docs/design.md`](docs/design.md).
