#!/usr/bin/env bash
# =============================================================================
# initialize-setup.macos.sh — Abyss Dev-Setup for macOS
# Clones the repo, checks/installs requirements and starts the app.
#
# Usage:
#   bash initialize-setup.macos.sh [target-dir] [dev|build]
#
# Defaults:
#   target-dir : ~/Projects/Abyss
#   action     : dev
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

# --- guard: macOS only -------------------------------------------------------
if [[ "$(uname)" != "Darwin" ]]; then
    die "Dieses Skript ist nur für macOS gedacht. Für Linux: setup-abyss.sh"
fi

# --- helpers -----------------------------------------------------------------
command_exists() { command -v "$1" &>/dev/null; }

check_node() {
    command_exists node || return 1
    local ver major
    ver=$(node -e 'process.stdout.write(process.versions.node)' 2>/dev/null)
    major="${ver%%.*}"
    [[ "$major" -ge "$REQUIRED_NODE_MAJOR" ]]
}

# --- Xcode Command Line Tools ------------------------------------------------
ensure_xcode_clt() {
    if xcode-select -p &>/dev/null; then
        ok "Xcode Command Line Tools vorhanden."
        return
    fi

    warn "Xcode Command Line Tools fehlen — Installation wird gestartet..."
    log "Ein macOS-Dialog erscheint gleich — bitte 'Installieren' klicken."
    xcode-select --install 2>/dev/null || true

    # Warten bis Installation abgeschlossen
    local timeout=300 elapsed=0
    while ! xcode-select -p &>/dev/null; do
        sleep 5
        elapsed=$((elapsed + 5))
        if [[ $elapsed -ge $timeout ]]; then
            die "Timeout: Xcode CLT wurde nicht installiert. Bitte manuell installieren und erneut starten."
        fi
        log "Warte auf Xcode CLT Installation... (${elapsed}s)"
    done
    ok "Xcode Command Line Tools installiert."
}

# --- Homebrew ----------------------------------------------------------------
ensure_brew() {
    if command_exists brew; then
        ok "Homebrew $(brew --version | head -1) gefunden."
        return
    fi

    warn "Homebrew nicht gefunden — wird installiert..."
    log "Homebrew ist der Standard-Paketmanager für macOS."
    /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

    # Apple Silicon: brew liegt unter /opt/homebrew
    if [[ -f "/opt/homebrew/bin/brew" ]]; then
        eval "$(/opt/homebrew/bin/brew shellenv)"
    fi

    command_exists brew || die "Homebrew-Installation fehlgeschlagen."
    ok "Homebrew installiert."
}

# --- Node.js via nvm oder Homebrew -------------------------------------------
install_node_via_nvm() {
    log "Installiere nvm..."
    export NVM_DIR="$HOME/.nvm"

    if [[ ! -d "$NVM_DIR" ]]; then
        curl -fsSL https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
    fi

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

    # nvm bereits vorhanden?
    if [[ -f "$HOME/.nvm/nvm.sh" ]]; then
        log "nvm gefunden, lade es..."
        # shellcheck source=/dev/null
        source "$HOME/.nvm/nvm.sh"
        install_node_via_nvm
        return
    fi

    # Homebrew-Fallback (macOS-nativ)
    if command_exists brew; then
        log "Installiere node@${REQUIRED_NODE_MAJOR} via Homebrew..."
        brew install "node@${REQUIRED_NODE_MAJOR}"
        # brew link setzt den Symlink; --overwrite falls eine andere Version aktiv ist
        brew link "node@${REQUIRED_NODE_MAJOR}" --force --overwrite || true

        # PATH für diese Session setzen (Apple Silicon & Intel)
        local brew_prefix
        brew_prefix="$(brew --prefix)"
        export PATH="${brew_prefix}/opt/node@${REQUIRED_NODE_MAJOR}/bin:$PATH"
    else
        warn "Homebrew nicht verfügbar — falle auf nvm zurück..."
        install_node_via_nvm
    fi

    check_node || die "Node-Installation fehlgeschlagen. Bitte manuell installieren: https://nodejs.org"
    ok "Node $(node -v) installiert."
}

# --- pnpm --------------------------------------------------------------------
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
        export PNPM_HOME="$HOME/.local/share/pnpm"
        export PATH="$PNPM_HOME:$PATH"
    fi

    command_exists pnpm || die "pnpm-Installation fehlgeschlagen."
    ok "pnpm $(pnpm -v) installiert."
}

# --- git ---------------------------------------------------------------------
ensure_git() {
    if command_exists git; then
        ok "git $(git --version | awk '{print $3}') gefunden."
        return
    fi

    # Auf macOS löst 'git' ohne CLT automatisch den Installations-Dialog aus —
    # aber wir haben ensure_xcode_clt bereits oben aufgerufen, daher sollte
    # git danach verfügbar sein.
    warn "git nicht gefunden — versuche via Homebrew..."
    command_exists brew && brew install git || die "git konnte nicht installiert werden."
    ok "git installiert."
}

# --- Electron-Abhängigkeiten -------------------------------------------------
check_electron_deps() {
    # macOS: Electron bringt alle notwendigen Frameworks selbst mit.
    # libxtst / libnss sind Linux-spezifisch und werden hier nicht benötigt.
    log "macOS: Electron-System-Abhängigkeiten werden nicht geprüft (nicht nötig)."

    # Rosetta 2 auf Apple Silicon prüfen (einige native Electron-Module brauchen es)
    if [[ "$(uname -m)" == "arm64" ]]; then
        if ! /usr/bin/pgrep -q oahd 2>/dev/null; then
            warn "Apple Silicon erkannt — Rosetta 2 scheint nicht aktiv zu sein."
            warn "Falls native Module Probleme machen: softwareupdate --install-rosetta --agree-to-license"
        else
            ok "Apple Silicon + Rosetta 2 aktiv."
        fi
    fi
}

# --- Repo klonen oder aktualisieren ------------------------------------------
clone_or_update() {
    if [[ -d "$TARGET_DIR/.git" ]]; then
        log "Repo bereits vorhanden unter $TARGET_DIR — führe git pull aus..."
        git -C "$TARGET_DIR" pull --ff-only
        ok "Repo aktualisiert."
    else
        log "Klone $REPO_URL nach $TARGET_DIR..."
        mkdir -p "$(dirname "$TARGET_DIR")"
        git clone "$REPO_URL" "$TARGET_DIR"
        ok "Repo geklont."
    fi
}

# --- npm Dependencies --------------------------------------------------------
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

# --- Aktion ausführen --------------------------------------------------------
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
            log "Erstelle Produktions-Build (macOS .dmg / .zip)..."
            pnpm build
            ok "Build fertig. Ausgabe: $TARGET_DIR/release/"
            ls -lh "$TARGET_DIR/release/" 2>/dev/null || true
            ;;
        *)
            die "Unbekannte Aktion '$ACTION'. Nutze: dev | build"
            ;;
    esac
}

# --- Einstiegspunkt ----------------------------------------------------------
main() {
    echo -e "${BOLD}${CYAN}"
    echo "╔══════════════════════════════════════════╗"
    echo "║      Abyss Setup — macOS                 ║"
    echo "╚══════════════════════════════════════════╝"
    echo -e "${RESET}"
    log "Zielverzeichnis : $TARGET_DIR"
    log "Aktion          : $ACTION"
    log "Architektur     : $(uname -m)"
    echo ""

    ensure_xcode_clt
    ensure_brew
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