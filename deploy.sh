#!/usr/bin/env bash
# Deploy claude/ + cursor/ from this repo into ~/.claude and ~/.cursor.
# Called by ai-kit (install/update). Idempotent. Backs up first.
#
# Whitelist deploy: only touches paths PRESENT in the repo's claude/ and cursor/
# subtrees. Anything else in user's ~/.claude or ~/.cursor is never touched.

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CLAUDE_HOME="${CLAUDE_HOME:-$HOME/.claude}"
CURSOR_HOME="${CURSOR_HOME:-$HOME/.cursor}"
TIMESTAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP_DIR="$HOME/ai-config-backup-$TIMESTAMP"

deploy_whitelist() {
  local src="$1" dst="$2" backup_sub="$3"
  [ -d "$src" ] || { echo "  ! $src not in repo, skip"; return; }
  mkdir -p "$dst"

  # Backup only the paths we are about to replace
  local backup_target="$BACKUP_DIR/$backup_sub"
  for entry in "$src"/* "$src"/.[!.]*; do
    [ -e "$entry" ] || continue
    local name; name="$(basename "$entry")"
    local user_path="$dst/$name"
    if [ -e "$user_path" ]; then
      mkdir -p "$backup_target"
      cp -R "$user_path" "$backup_target/$name"
    fi
  done

  # Copy each whitelisted entry from repo to user
  for entry in "$src"/* "$src"/.[!.]*; do
    [ -e "$entry" ] || continue
    local name; name="$(basename "$entry")"
    local target="$dst/$name"
    if [ -e "$target" ]; then rm -rf "$target"; fi
    cp -R "$entry" "$target"
    echo "  + $name -> $target"
  done
}

mkdir -p "$BACKUP_DIR"
deploy_whitelist "$REPO_ROOT/claude" "$CLAUDE_HOME" ".claude"
deploy_whitelist "$REPO_ROOT/cursor" "$CURSOR_HOME" ".cursor"

# If backup dir is empty (first run), remove it
rmdir "$BACKUP_DIR" 2>/dev/null || echo "  ✓ backup -> $BACKUP_DIR"
