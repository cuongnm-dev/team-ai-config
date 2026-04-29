#!/usr/bin/env bash
# Team AI config bootstrap — Mac / Linux
# One-liner: curl -sL https://raw.githubusercontent.com/cuongnm-dev/team-ai-config/main/bootstrap.sh | bash
# With auto-install:  ... | bash -s -- --auto-install

set -euo pipefail

REPO_URL="${REPO_URL:-https://github.com/cuongnm-dev/team-ai-config.git}"
AI_KIT_HOME="${AI_KIT_HOME:-$HOME/.ai-kit}"
REPO_DIR="$AI_KIT_HOME/team-ai-config"
BIN_DIR="$AI_KIT_HOME/bin"
AUTO_INSTALL=0
[ "${1:-}" = "--auto-install" ] && AUTO_INSTALL=1

# ─── colors ────────────────────────────────────────────────────────────
if [ -t 1 ]; then BOLD='\033[1m'; GREEN='\033[32m'; RED='\033[31m'; YELLOW='\033[33m'; RESET='\033[0m'
else BOLD=''; GREEN=''; RED=''; YELLOW=''; RESET=''; fi
info() { echo -e "${BOLD}▶${RESET} $*"; }
ok()   { echo -e "  ${GREEN}✓${RESET} $*"; }
warn() { echo -e "  ${YELLOW}⚠${RESET} $*"; }
err()  { echo -e "  ${RED}✗${RESET} $*" >&2; }

# ─── detect OS ─────────────────────────────────────────────────────────
detect_os() {
  case "$(uname -s)" in
    Darwin) echo "macos" ;;
    Linux)
      if [ -f /etc/debian_version ]; then echo "debian"
      elif [ -f /etc/redhat-release ] || [ -f /etc/fedora-release ]; then echo "rhel"
      elif [ -f /etc/arch-release ]; then echo "arch"
      else echo "linux"
      fi
      ;;
    *) echo "unknown" ;;
  esac
}
OS=$(detect_os)
info "Detected OS: $OS"

# ─── install hint per OS ───────────────────────────────────────────────
hint_install() {
  local tool="$1"
  case "$OS-$tool" in
    macos-git)    echo "xcode-select --install   (or: brew install git)" ;;
    macos-docker) echo "Download Docker Desktop: https://www.docker.com/products/docker-desktop" ;;
    macos-rsync)  echo "brew install rsync   (usually pre-installed)" ;;
    macos-python) echo "brew install python@3.12   (or use pre-installed python3)" ;;
    macos-node)   echo "brew install node   (or use nvm)" ;;

    debian-git)    echo "sudo apt update && sudo apt install -y git" ;;
    debian-docker) echo "https://docs.docker.com/engine/install/ubuntu/ (or: curl -fsSL https://get.docker.com | sh)" ;;
    debian-rsync)  echo "sudo apt install -y rsync" ;;
    debian-python) echo "sudo apt install -y python3 python3-pip" ;;
    debian-node)   echo "curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash - && sudo apt install -y nodejs" ;;
    rhel-node)     echo "sudo dnf module install -y nodejs:20" ;;
    arch-node)     echo "sudo pacman -S nodejs npm" ;;

    rhel-git)    echo "sudo dnf install -y git" ;;
    rhel-docker) echo "https://docs.docker.com/engine/install/centos/" ;;
    rhel-rsync)  echo "sudo dnf install -y rsync" ;;
    rhel-python) echo "sudo dnf install -y python3" ;;

    arch-git)    echo "sudo pacman -S git" ;;
    arch-docker) echo "sudo pacman -S docker docker-compose" ;;
    arch-rsync)  echo "sudo pacman -S rsync" ;;
    arch-python) echo "sudo pacman -S python" ;;

    *) echo "Install $tool via your package manager" ;;
  esac
}

# ─── auto-install (only if --auto-install flag) ───────────────────────
auto_install() {
  local tool="$1"
  case "$OS-$tool" in
    macos-rsync|macos-git|macos-python)
      command -v brew >/dev/null 2>&1 || { warn "Homebrew not found; cannot auto-install. Install: https://brew.sh"; return 1; }
      case "$tool" in
        rsync)  brew install rsync ;;
        git)    brew install git ;;
        python) brew install python@3.12 ;;
      esac
      ;;
    debian-rsync|debian-git|debian-python)
      sudo apt update -qq && sudo apt install -y "$tool"
      [ "$tool" = "python" ] && sudo apt install -y python3
      ;;
    rhel-rsync|rhel-git|rhel-python)
      sudo dnf install -y "$tool"
      [ "$tool" = "python" ] && sudo dnf install -y python3
      ;;
    arch-rsync|arch-git|arch-python)
      sudo pacman -S --noconfirm "$tool"
      ;;
    *-docker)
      err "Docker auto-install too risky (admin + license + reboot). Install manually:"
      err "  $(hint_install docker)"
      return 1
      ;;
    *)
      err "No auto-install rule for $OS-$tool"
      return 1
      ;;
  esac
}

# ─── env check ─────────────────────────────────────────────────────────
info "Checking environment"

declare -a MISSING=()
check_tool() {
  local tool="$1" cmd="${2:-$1}"
  if command -v "$cmd" >/dev/null 2>&1; then
    ok "$tool: $($cmd --version 2>&1 | head -1 || echo found)"
  else
    err "$tool MISSING — Install: $(hint_install "$tool")"
    MISSING+=("$tool")
  fi
}
check_tool git
check_tool docker
check_tool rsync
check_tool python python3
check_tool curl
check_tool node

# Node.js >= 18 check
if command -v node >/dev/null 2>&1; then
  NODE_MAJOR=$(node -p 'process.versions.node.split(".")[0]' 2>/dev/null || echo 0)
  if [ "$NODE_MAJOR" -lt 18 ]; then
    err "node is too old (v$NODE_MAJOR) — ai-kit needs Node >= 18"
    MISSING+=("node")
  fi
fi

# Docker daemon check
if command -v docker >/dev/null 2>&1; then
  if docker info >/dev/null 2>&1; then ok "docker daemon running"
  else err "docker daemon NOT running — Start Docker Desktop and re-run"; MISSING+=("docker-daemon")
  fi
fi

# Handle missing
if [ "${#MISSING[@]}" -gt 0 ]; then
  echo ""
  if [ "$AUTO_INSTALL" = 1 ]; then
    info "Auto-installing missing tools (--auto-install)"
    for tool in "${MISSING[@]}"; do
      [ "$tool" = "docker-daemon" ] && continue
      info "  Installing $tool..."
      if auto_install "$tool"; then ok "$tool installed"
      else err "$tool install failed — install manually + re-run"; exit 1
      fi
    done
  else
    err "Missing ${#MISSING[@]} required tool(s). Install above + re-run, or use --auto-install:"
    err "  curl -sL <bootstrap.sh> | bash -s -- --auto-install"
    exit 1
  fi
fi

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

# ─── auto-install glow (optional pretty markdown renderer) ────────────
if ! command -v glow >/dev/null 2>&1; then
  info "Installing glow (markdown renderer for prettier docs)"
  case "$OS" in
    macos)
      command -v brew >/dev/null 2>&1 && brew install glow >/dev/null 2>&1 && ok "glow installed" || \
        warn "Skip glow (no brew). Manual: https://github.com/charmbracelet/glow#installation"
      ;;
    debian)
      if command -v snap >/dev/null 2>&1; then
        sudo snap install glow >/dev/null 2>&1 && ok "glow installed" || warn "Skip glow"
      else
        warn "Skip glow (no snap). Manual: https://github.com/charmbracelet/glow#installation"
      fi
      ;;
    rhel|arch)
      warn "Skip glow auto-install on $OS. Manual: https://github.com/charmbracelet/glow#installation"
      ;;
    *)
      warn "Skip glow (unknown OS). Manual: https://github.com/charmbracelet/glow#installation"
      ;;
  esac
fi

# ─── install Node deps (one-time) ──────────────────────────────────────
if [ -f "$REPO_DIR/package.json" ]; then
  if [ ! -d "$REPO_DIR/node_modules" ]; then
    info "Installing Node.js dependencies"
    (cd "$REPO_DIR" && npm install --omit=dev --silent) && ok "Node deps installed" || warn "npm install failed — CLI will fall back to legacy mode"
  fi
fi

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
