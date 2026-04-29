#!/usr/bin/env bash
# deploy.sh — migration stub for ai-kit versions < 0.2.0 (bash CLI era)
# New ai-kit (Node.js) handles deployment inline in cmdUpdate.
# This stub is kept so old cached CLIs can finish their update cycle cleanly.

set -e
REPO_DIR="$(cd "$(dirname "$0")" && pwd)"
HOME_DIR="${HOME:-$(eval echo ~)}"

_ok()   { echo "  ✓ $*"; }
_info() { echo "▶ $*"; }

deploy_dir() {
  local src="$REPO_DIR/$1" dst="$HOME_DIR/$2"
  [ -d "$src" ] || return 0
  mkdir -p "$dst"
  if command -v rsync >/dev/null 2>&1; then
    rsync -a --delete "$src/" "$dst/"
  else
    cp -R "$src/." "$dst/"
  fi
  _ok "$2"
}

_info "Deploying agents + skills"
deploy_dir "claude/agents"  ".claude/agents"
deploy_dir "claude/skills"  ".claude/skills"
deploy_dir "cursor/agents"  ".cursor/agents"
deploy_dir "cursor/skills"  ".cursor/skills"
_ok "Deploy complete (run 'ai-kit update' again to use new Node.js CLI)"
