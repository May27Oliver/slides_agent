#!/usr/bin/env bash
#
# Install repo git hooks (currently: post-commit → GitNexus auto-analyze).
#
# Usage:  bash scripts/install-git-hooks.sh   (or: pnpm hooks:install)
#
# Symlinks the version-controlled hook into .git/hooks/ (so edits to the tracked
# file take effect with no re-install) and pins this machine's gitnexus runner
# into LOCAL git config — keeping the tracked hook portable across machines.
set -euo pipefail

REPO_ROOT="$(git rev-parse --show-toplevel 2>/dev/null)" || {
  echo "error: not inside a git repository" >&2
  exit 1
}

SRC="$REPO_ROOT/scripts/git-hooks/post-commit"
DEST="$REPO_ROOT/.git/hooks/post-commit"

[ -f "$SRC" ] || { echo "error: missing $SRC" >&2; exit 1; }

# Never destroy an unrelated existing hook.
if [ -e "$DEST" ] && [ ! -L "$DEST" ] && ! grep -q "gitnexus analyze" "$DEST" 2>/dev/null; then
  echo "error: a different post-commit hook already exists:" >&2
  echo "       $DEST" >&2
  echo "       back it up or merge manually, then re-run." >&2
  exit 1
fi

chmod +x "$SRC"
ln -sf "$SRC" "$DEST"
echo "✓ installed post-commit hook → .git/hooks/post-commit"

# --- Pin this machine's gitnexus runner (optional, best-effort) ---------------
# The Claude Code GitNexus hook runs a specific global install; matching it keeps
# the index format consistent. Auto-detect the highest-version gitnexus CLI.
best_ver=""; best_node=""; best_cli=""
for cli in \
  "$HOME"/.nvm/versions/node/*/lib/node_modules/gitnexus/dist/cli/index.js \
  /usr/local/lib/node_modules/gitnexus/dist/cli/index.js \
  /opt/homebrew/lib/node_modules/gitnexus/dist/cli/index.js
do
  [ -f "$cli" ] || continue
  node_bin="$(cd "$(dirname "$cli")/../../../../../bin" 2>/dev/null && pwd)/node"
  [ -x "$node_bin" ] || node_bin="$(command -v node || true)"
  [ -x "$node_bin" ] || continue
  ver="$("$node_bin" "$cli" --version 2>/dev/null | tr -d '[:space:]')"
  [ -n "$ver" ] || continue
  if [ -z "$best_ver" ] || [ "$(printf '%s\n%s\n' "$best_ver" "$ver" | sort -V | tail -1)" = "$ver" ]; then
    best_ver="$ver"; best_node="$node_bin"; best_cli="$cli"
  fi
done

if [ -n "$best_cli" ]; then
  git config gitnexus.node "$best_node"
  git config gitnexus.cli "$best_cli"
  echo "✓ pinned gitnexus runner (local git config): gitnexus $best_ver"
  echo "    gitnexus.node = $best_node"
  echo "    gitnexus.cli  = $best_cli"
else
  echo "• no global gitnexus detected — hook will fall back to PATH / npx"
fi
