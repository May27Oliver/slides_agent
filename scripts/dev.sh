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

osascript - "$ROOT_DIR" <<'APPLESCRIPT'
on run argv
  set projectRoot to item 1 of argv
  set apiCommand to "cd " & quoted form of projectRoot & " && pnpm --filter @slides-agent/api dev"
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

    tell apiSession
      set webSession to (split vertically with default profile)
    end tell

    tell apiSession
      write text apiCommand
    end tell

    tell webSession
      write text webCommand
    end tell
  end tell
end run
APPLESCRIPT
