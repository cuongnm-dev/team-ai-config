#!/usr/bin/env bash
# Team AI config bootstrap — Mac / Linux
# One-liner: curl -sL https://raw.githubusercontent.com/cuongnm-dev/team-ai-config/main/bootstrap.sh | bash

set -euo pipefail

REPO_URL="${REPO_URL:-https://github.com/cuongnm-dev/team-ai-config.git}"
AI_KIT_HOME="${AI_KIT_HOME:-$HOME/.ai-kit}"
REPO_DIR="$AI_KIT_HOME/team-ai-config"
BIN_DIR="$AI_KIT_HOME/bin"

# ─── colors ────────────────────────────────────────────────────────────
if [ -t 1 ]; then BOLD='\033[1m'; GREEN='\033[32m'; RED='\033[31m'; RESET='\033[0m'; else BOLD=''; GREEN=''; RED=''; RESET=''; fi
info() { echo -e "${BOLD}▶${RESET} $*"; }
ok()   { echo -e "  ${GREEN}✓${RESET} $*"; }
err()  { echo -e "  ${RED}✗${RESET} $*" >&2; }

# ─── pre-flight ────────────────────────────────────────────────────────
need() { command -v "$1" >/dev/null 2>&1 || { err "Required: $1 (not found)"; exit 1; }; }
need git
need docker
need rsync
docker info >/dev/null 2>&1 || { err "Docker daemon not running"; exit 1; }

# ─── clone / refresh repo ──────────────────────────────────────────────
mkdir -p "$AI_KIT_HOME"
if [ -d "$REPO_DIR/.git" ]; then
  info "Existing repo at $REPO_DIR — pulling latest"
  git -C "$REPO_DIR" pull --ff-only --quiet
else
  info "Cloning team-ai-config to $REPO_DIR"
  git clone --quiet "$REPO_URL" "$REPO_DIR"
fi
ok "Repo at $(git -C "$REPO_DIR" rev-parse --short HEAD)"

# ─── install ai-kit CLI to bin/ ────────────────────────────────────────
mkdir -p "$BIN_DIR"
ln -sf "$REPO_DIR/bin/ai-kit" "$BIN_DIR/ai-kit"
chmod +x "$REPO_DIR/bin/ai-kit"
ok "Linked $BIN_DIR/ai-kit"

# ─── add to PATH if not present ────────────────────────────────────────
add_to_shell_rc() {
  local rc="$1"
  if [ -f "$rc" ] && ! grep -q "AI_KIT_HOME" "$rc"; then
    {
      echo ""
      echo "# ai-kit"
      echo "export AI_KIT_HOME=\"\$HOME/.ai-kit\""
      echo "export PATH=\"\$AI_KIT_HOME/bin:\$PATH\""
    } >> "$rc"
    ok "Added to $rc"
  fi
}
add_to_shell_rc "$HOME/.bashrc"
add_to_shell_rc "$HOME/.zshrc"
add_to_shell_rc "$HOME/.profile"

# ─── run first-time deploy ─────────────────────────────────────────────
info "Running first-time deploy"
export PATH="$BIN_DIR:$PATH"
"$REPO_DIR/bin/ai-kit" update

# ─── done ──────────────────────────────────────────────────────────────
cat <<EOF

${BOLD}${GREEN}✅ ai-kit installed.${RESET}

  Open a NEW terminal so PATH picks up, or run:
    export PATH="\$HOME/.ai-kit/bin:\$PATH"

  Then try:
    ai-kit status
    ai-kit help

  Update later:
    ai-kit update
EOF
