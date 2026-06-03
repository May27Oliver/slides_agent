# HTML Slides Agent

Local web app for generating previewable HTML slide decks.

## Prerequisites

- Node.js `20.19.5`
- pnpm `10.30.3`
- A root `.env` file. Copy `.env.example` if needed:

```bash
cp .env.example .env
```

Install dependencies:

```bash
pnpm install
```

## Start Local Servers

To split the current iTerm2 tab into two panes and start both servers with one command:

```bash
pnpm dev:iterm
```

This uses the current iTerm2 tab when available, splits it into two panes, and starts one pane for the backend API server and one pane for the frontend dev server.

Or start them manually:

Run the backend API server in one terminal:

```bash
pnpm --filter @slides-agent/api dev
```

The API listens on:

```text
http://localhost:3000
```

The backend dev command runs in watch mode and restarts automatically when API source files change.

Run the frontend dev server in another terminal:

```bash
pnpm --filter @slides-agent/web dev -- --host localhost --port 5173
```

Open the app at:

```text
http://localhost:5173
```

The web dev server proxies `/api/*` requests to `http://localhost:3000` by default. Override with `VITE_API_PROXY_TARGET` if needed.

The frontend dev server uses Vite HMR and updates the browser when frontend source files change.

## Check Servers

Check the frontend:

```bash
curl -I http://localhost:5173/
```

Check the backend preview job endpoint:

```bash
curl -i http://localhost:3000/api/slides/preview-jobs/example
```

The backend check should return `404` with `PREVIEW_JOB_UNAVAILABLE` when the server is running.

## Useful Commands

```bash
pnpm test
pnpm --filter @slides-agent/domain build
pnpm --filter @slides-agent/contracts build
pnpm --filter @slides-agent/api build
pnpm --filter @slides-agent/web build
pnpm --filter @slides-agent/web test:e2e
```
