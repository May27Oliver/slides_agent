#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

if ! command -v osascript >/dev/null 2>&1; then
  echo "osascript is required. This script only supports macOS with iTerm2." >&2
  exit 1
fi

if ! command -v pnpm >/dev/null 2>&1; then
  echo "pnpm is required. Install pnpm before starting dev servers." >&2
  exit 1
fi

# Preview generation runs on a Redis + BullMQ queue; the API and worker fail
# fast without Redis. Warn (non-blocking) if it is not reachable so the panes
# below don't just error out on startup.
REDIS_HOST="${REDIS_HOST:-127.0.0.1}"
REDIS_PORT="${REDIS_PORT:-6379}"
if ! (exec 3<>"/dev/tcp/${REDIS_HOST}/${REDIS_PORT}") 2>/dev/null; then
  echo "⚠️  Redis is not reachable at ${REDIS_HOST}:${REDIS_PORT}."
  echo "    The API and worker require it and will fail fast. Start it first, e.g.:"
  echo "      docker run --rm -p 6379:6379 --name slides-redis redis:7"
  echo ""
fi

# Layout: left column = API (top) + worker (bottom), right column = web.
osascript - "$ROOT_DIR" <<'APPLESCRIPT'
on run argv
  set projectRoot to item 1 of argv
  set apiCommand to "cd " & quoted form of projectRoot & " && pnpm --filter @slides-agent/api dev"
  set workerCommand to "cd " & quoted form of projectRoot & " && pnpm --filter @slides-agent/api worker:dev"
  set webCommand to "cd " & quoted form of projectRoot & " && pnpm --filter @slides-agent/web dev -- --host localhost --port 5173"

  tell application "iTerm2"
    activate

    if (count of windows) is 0 then
      set devWindow to (create window with default profile)
    else
      set devWindow to current window
    end if

    tell current tab of devWindow
      set apiSession to current session
    end tell

    -- Right pane (full height): web
    tell apiSession
      set webSession to (split vertically with default profile)
    end tell

    -- Split the left pane top/bottom: API (top) + worker (bottom)
    tell apiSession
      set workerSession to (split horizontally with default profile)
    end tell

    tell apiSession
      write text apiCommand
    end tell

    tell workerSession
      write text workerCommand
    end tell

    tell webSession
      write text webCommand
    end tell
  end tell
end run
APPLESCRIPT
