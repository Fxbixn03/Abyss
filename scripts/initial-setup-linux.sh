#!/usr/bin/env bash
# =============================================================================
# setup-abyss.sh — Abyss Dev-Setup for Linux
# Clones the repo, checks/installs requirements and starts the app.
# =============================================================================

set -euo pipefail

# --- colors & logging --------------------------------------------------------
RED='\033[0;31m'; YELLOW='\033[1;33m'; GREEN='\033[0;32m'
CYAN='\033[0;36m'; BOLD='\033[1m'; RESET='\033[0m'

log()  { echo -e "${CYAN}[INFO]${RESET}  $*"; }
ok()   { echo -e "${GREEN}[OK]${RESET}    $*"; }
warn() { echo -e "${YELLOW}[WARN]${RESET}  $*"; }
err()  { echo -e "${RED}[ERROR]${RESET} $*" >&2; }
die()  { err "$*"; exit 1; }

# --- configuration -----------------------------------------------------------
REPO_URL="https://github.com/Fxbixn03/Abyss.git"
TARGET_DIR="${1:-$HOME/Projects/Abyss}"
REQUIRED_NODE_MAJOR=20
ACTION="${2:-dev}"   # dev | build

# --- helpers ---------------------------------------------------------
command_exists() { command -v "$1" &>/dev/null; }

check_node() {
    if ! command_exists node; then
        return 1
    fi
    local ver
    ver=$(node -e 'process.stdout.write(process.versions.node)' 2>/dev/null)
    local major="${ver%%.*}"
    [[ "$major" -ge "$REQUIRED_NODE_MAJOR" ]] && return 0 || return 1
}

install_node_via_nvm() {
    log "Installiere nvm..."
    export NVM_DIR="$HOME/.nvm"

    if [[ ! -d "$NVM_DIR" ]]; then
        curl -fsSL https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
    fi

    # load nvm in Shell
    # shellcheck source=/dev/null
    source "$NVM_DIR/nvm.sh"

    if [[ -f "$TARGET_DIR/.nvmrc" ]]; then
        log "Lese Node-Version aus .nvmrc..."
        nvm install
        nvm use
    else
        log "Installiere Node $REQUIRED_NODE_MAJOR (LTS)..."
        nvm install "$REQUIRED_NODE_MAJOR"
        nvm use "$REQUIRED_NODE_MAJOR"
    fi
    ok "Node $(node -v) via nvm aktiv."
}

ensure_node() {
    if check_node; then
        ok "Node $(node -v) gefunden — passt."
        return
    fi

    warn "Node ≥ $REQUIRED_NODE_MAJOR nicht gefunden."

    # nvm vorhanden?
    if [[ -f "$HOME/.nvm/nvm.sh" ]]; then
        log "nvm gefunden, lade es..."
        # shellcheck source=/dev/null
        source "$HOME/.nvm/nvm.sh"
        install_node_via_nvm
        return
    fi

    # Paketmanager-Fallback (nur wenn kein nvm)
    if command_exists pacman; then
        log "Installiere nodejs via pacman..."
        sudo pacman -S --noconfirm nodejs npm
    elif command_exists apt-get; then
        log "Installiere nodejs via apt..."
        curl -fsSL https://deb.nodesource.com/setup_${REQUIRED_NODE_MAJOR}.x | sudo -E bash -
        sudo apt-get install -y nodejs
    elif command_exists dnf; then
        log "Installiere nodejs via dnf..."
        sudo dnf install -y nodejs
    else
        warn "Kein bekannter Paketmanager. Installiere nvm als Fallback..."
        install_node_via_nvm
    fi

    check_node || die "Node-Installation fehlgeschlagen. Bitte manuell installieren: https://nodejs.org"
    ok "Node $(node -v) installiert."
}

ensure_pnpm() {
    if command_exists pnpm; then
        ok "pnpm $(pnpm -v) gefunden."
        return
    fi

    warn "pnpm nicht gefunden — wird installiert..."

    if command_exists npm; then
        npm install -g pnpm
    else
        curl -fsSL https://get.pnpm.io/install.sh | sh
        # In PATH aufnehmen für aktuelle Session
        export PNPM_HOME="$HOME/.local/share/pnpm"
        export PATH="$PNPM_HOME:$PATH"
    fi

    command_exists pnpm || die "pnpm-Installation fehlgeschlagen."
    ok "pnpm $(pnpm -v) installiert."
}

ensure_git() {
    command_exists git && return
    warn "git nicht gefunden — wird installiert..."
    if command_exists pacman; then
        sudo pacman -S --noconfirm git
    elif command_exists apt-get; then
        sudo apt-get install -y git
    elif command_exists dnf; then
        sudo dnf install -y git
    else
        die "git nicht gefunden und kein bekannter Paketmanager. Bitte git manuell installieren."
    fi
    ok "git installiert."
}

check_electron_deps() {
    # Häufig fehlende Libs auf Arch/minimal Setups
    local missing=()
    for lib in libxtst libnss; do
        if ! ldconfig -p 2>/dev/null | grep -q "$lib" && ! pacman -Qq "${lib}" &>/dev/null 2>&1; then
            missing+=("$lib")
        fi
    done

    if [[ ${#missing[@]} -gt 0 ]]; then
        warn "Möglicherweise fehlende Electron-Libs: ${missing[*]}"
        warn "Bei Problemen: sudo pacman -S libxtst nss  (oder apt: libxtst6 libnss3)"
    fi
}

clone_or_update() {
    if [[ -d "$TARGET_DIR/.git" ]]; then
        log "Repo bereits vorhanden unter $TARGET_DIR — führe git pull aus..."
        git -C "$TARGET_DIR" pull --ff-only
        ok "Repo aktualisiert."
    else
        log "Klone $REPO_URL nach $TARGET_DIR..."
        git clone "$REPO_URL" "$TARGET_DIR"
        ok "Repo geklont."
    fi
}

install_deps() {
    log "Installiere npm-Dependencies via pnpm..."
    cd "$TARGET_DIR"

    # .nvmrc berücksichtigen falls nvm aktiv
    if [[ -f ".nvmrc" ]] && command_exists nvm 2>/dev/null; then
        nvm use 2>/dev/null || true
    fi

    pnpm install
    ok "Dependencies installiert."
}

run_action() {
    cd "$TARGET_DIR"
    case "$ACTION" in
        dev)
            log "Starte Abyss im Dev-Modus (Vite + Electron, hot reload)..."
            log "Fenster öffnet sich gleich. Beenden: Ctrl+C"
            echo ""
            pnpm dev
            ;;
        build)
            log "Erstelle Produktions-Build (AppImage)..."
            pnpm build
            ok "Build fertig. Ausgabe: $TARGET_DIR/release/"
            ls -lh "$TARGET_DIR/release/" 2>/dev/null || true
            ;;
        *)
            die "Unbekannte Aktion '$ACTION'. Nutze: dev | build"
            ;;
    esac
}

# --- Hauptprogramm -----------------------------------------------------------
main() {
    echo -e "${BOLD}${CYAN}"
    echo "╔══════════════════════════════════════════╗"
    echo "║        Abyss Setup — Linux               ║"
    echo "╚══════════════════════════════════════════╝"
    echo -e "${RESET}"
    log "Zielverzeichnis : $TARGET_DIR"
    log "Aktion          : $ACTION"
    echo ""

    ensure_git
    ensure_node
    ensure_pnpm
    check_electron_deps
    clone_or_update
    install_deps
    echo ""
    run_action
}

main