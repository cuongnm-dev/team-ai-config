#!/usr/bin/env bash
# Pack current ~/.claude and ~/.cursor into team-ai-config repo (Mac/Linux).
# Maintainer-only: run this BEFORE git commit to refresh shared config.
#
# Whitelist approach: ONLY copy paths in INCLUDE_CLAUDE / INCLUDE_CURSOR.
# Everything else stays in your local ~/. The team repo is a curated subset.

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CLAUDE_HOME="${CLAUDE_HOME:-$HOME/.claude}"
CURSOR_HOME="${CURSOR_HOME:-$HOME/.cursor}"

DRY_RUN=0
[ "${1:-}" = "--dry-run" ] && DRY_RUN=1

# What to share from ~/.claude
INCLUDE_CLAUDE=(
  agents          # team agents
  skills          # team skills
  schemas         # LIFECYCLE.md, JSON schemas, intel contracts
  scripts         # meta_helper.py, merger.py, validators
  CLAUDE.md       # global rules
)

# What to share from ~/.cursor
INCLUDE_CURSOR=(
  agents          # team agents
  skills          # team skills
  skills-cursor   # Cursor-specific skill variants
  rules           # Cursor rules
  commands        # slash commands
  playbooks       # playbooks
  templates       # code templates
  AGENTS.md       # Cursor conventions
  mcp.json        # MCP config template
)

human_size() {
  local p="$1"
  if [ -d "$p" ]; then du -sh "$p" 2>/dev/null | awk '{print $1}'
  elif [ -f "$p" ]; then du -h "$p" 2>/dev/null | awk '{print $1}'
  else echo "?"; fi
}

sync_whitelist() {
  local src="$1" dst="$2"
  shift 2
  local include=("$@")

  if [ ! -d "$src" ]; then
    echo "  ! $src not found, skip"; return
  fi

  if [ "$DRY_RUN" != 1 ]; then
    rm -rf "$dst"
    mkdir -p "$dst"
  fi

  for name in "${include[@]}"; do
    local s="$src/$name" d="$dst/$name"
    if [ ! -e "$s" ]; then
      echo "  ! missing in source: $name"; continue
    fi
    echo "  + $name ($(human_size "$s"))"
    [ "$DRY_RUN" = 1 ] && continue
    if [ -d "$s" ]; then cp -R "$s" "$d"
    else cp "$s" "$d"
    fi
  done
}

echo "▶ Packing claude config from $CLAUDE_HOME"
sync_whitelist "$CLAUDE_HOME" "$REPO_ROOT/claude" "${INCLUDE_CLAUDE[@]}"

echo ""
echo "▶ Packing cursor config from $CURSOR_HOME"
sync_whitelist "$CURSOR_HOME" "$REPO_ROOT/cursor" "${INCLUDE_CURSOR[@]}"

echo ""
echo "▶ Scanning for machine-specific paths in shared content..."
SUSPICIOUS=$(grep -rlE "C:[/\\\\]Users[/\\\\][a-zA-Z0-9_-]+|D:[/\\\\]MCP Server|/Users/[a-zA-Z0-9_-]+/\.claude" \
  "$REPO_ROOT/claude" "$REPO_ROOT/cursor" 2>/dev/null | head -10 || true)
if [ -n "$SUSPICIOUS" ]; then
  echo "  ! found machine-specific paths:"
  echo "$SUSPICIOUS" | sed 's/^/    /'
  echo ""
  echo "  Replace before commit:"
  echo "    C:/Users/<name>/.claude  ->  ~/.claude  (or \$HOME/.claude)"
  echo "    D:/MCP Server/etc-platform  ->  bake into image / parameterize"
else
  echo "  ok: no machine-specific paths detected"
fi

echo ""
echo "Packed. Next: git status / git add / git commit / git push"
[ "$DRY_RUN" = 1 ] && echo "(dry-run only - nothing copied)"
