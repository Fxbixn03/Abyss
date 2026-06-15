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

    # nvm exists?
    if [[ -f "$HOME/.nvm/nvm.sh" ]]; then
        log "nvm gefunden, lade es..."
        # shellcheck source=/dev/null
        source "$HOME/.nvm/nvm.sh"
        install_node_via_nvm
        return
    fi

    # Paketmanager-Fallback (nur falls kein nvm gefunden).
    # Versuch ist non-fatal: schlägt er fehl, fallen wir auf nvm zurück.
    if install_node_via_pkg_manager; then
        if check_node; then
            ok "Node $(node -v) installiert."
            return
        fi
        warn "Paketmanager lieferte eine zu alte/keine Node-Version — versuche nvm..."
    else
        warn "Installation über den Paketmanager fehlgeschlagen."
        warn "Tipp: Paketquellen/Index aktualisieren und erneut versuchen (z.B. ein System-Update)."
        warn "Falle auf nvm zurück..."
    fi

    install_node_via_nvm
    check_node || die "Node-Installation fehlgeschlagen. Bitte manuell installieren: https://nodejs.org"
    ok "Node $(node -v) installiert."
}

# Versucht Node über den erkannten System-Paketmanager zu installieren.
# Gibt 0 zurück bei Erfolg, sonst != 0 (Aufrufer kann auf nvm zurückfallen).
install_node_via_pkg_manager() {
    if command_exists apt-get; then
        log "Installiere nodejs via apt..."
        curl -fsSL "https://deb.nodesource.com/setup_${REQUIRED_NODE_MAJOR}.x" | sudo -E bash - \
            && sudo apt-get install -y nodejs
    elif command_exists dnf; then
        log "Installiere nodejs via dnf..."
        sudo dnf install -y nodejs
    elif command_exists pacman; then
        log "Installiere nodejs via pacman..."
        sudo pacman -S --noconfirm nodejs npm
    elif command_exists zypper; then
        log "Installiere nodejs via zypper..."
        sudo zypper install -y nodejs npm
    else
        warn "Kein bekannter Paketmanager gefunden."
        return 1
    fi
}

# Ermittelt die passende Shell-Konfig-Datei für PATH-Persistierung.
shell_rc_file() {
    [[ -n "${ZSH_VERSION:-}" ]] && { echo "$HOME/.zshrc"; return; }
    echo "$HOME/.bashrc"
}

# Hängt einen Verzeichnis-Eintrag dauerhaft an den PATH in der Shell-Konfig an,
# sofern er dort noch nicht vorkommt.
persist_path_entry() {
    local dir="$1" rc
    rc="$(shell_rc_file)"
    [[ -f "$rc" ]] || touch "$rc"
    if ! grep -qF "$dir" "$rc"; then
        {
            echo ''
            echo "# hinzugefügt von Abyss-Setup"
            echo "export PATH=\"$dir:\$PATH\""
        } >> "$rc"
        log "PATH-Eintrag '$dir' in $rc ergänzt (neue Shell oder 'source $rc' nötig)."
    fi
}

ensure_pnpm() {
    if command_exists pnpm; then
        ok "pnpm $(pnpm -v) gefunden."
        return
    fi

    warn "pnpm nicht gefunden — wird installiert..."

    # 1) Corepack (kommt mit Node ≥ 16, offizieller pnpm-Weg)
    if command_exists corepack; then
        log "Aktiviere pnpm via corepack..."
        corepack enable pnpm 2>/dev/null || corepack enable 2>/dev/null || true
        corepack prepare pnpm@latest --activate 2>/dev/null || true
    fi

    # 2) Fallback: npm global
    if ! command_exists pnpm && command_exists npm; then
        local prefix_dir
        prefix_dir="$(npm prefix -g 2>/dev/null)"
        if [[ -n "$prefix_dir" && -w "$prefix_dir" ]]; then
            log "Installiere pnpm via npm (global)..."
            npm install -g pnpm
        else
            # Globales Prefix nicht beschreibbar (z.B. System-Node unter /usr).
            # In ein user-eigenes Prefix installieren statt sudo zu erzwingen.
            log "Globales npm-Prefix nicht beschreibbar — installiere pnpm ins User-Prefix ($HOME/.local)..."
            npm install -g pnpm --prefix "$HOME/.local"
            export PATH="$HOME/.local/bin:$PATH"
            persist_path_entry "$HOME/.local/bin"
        fi
    fi

    # 3) Fallback: Standalone-Installer
    if ! command_exists pnpm; then
        log "Installiere pnpm via Standalone-Installer..."
        curl -fsSL https://get.pnpm.io/install.sh | sh -
        # Für diese Session verfügbar machen und dauerhaft persistieren.
        export PNPM_HOME="${PNPM_HOME:-$HOME/.local/share/pnpm}"
        export PATH="$PNPM_HOME:$PATH"
        persist_path_entry "$PNPM_HOME"
    fi

    command_exists pnpm || die "pnpm-Installation fehlgeschlagen. Bitte manuell: https://pnpm.io/installation"
    ok "pnpm $(pnpm -v) installiert."
}

ensure_git() {
    command_exists git && return
    warn "git nicht gefunden — wird installiert..."
    if command_exists apt-get; then
        sudo apt-get install -y git
    elif command_exists dnf; then
        sudo dnf install -y git
    elif command_exists pacman; then
        sudo pacman -S --noconfirm git
    elif command_exists zypper; then
        sudo zypper install -y git
    else
        die "git nicht gefunden und kein bekannter Paketmanager. Bitte git manuell installieren."
    fi
    ok "git installiert."
}

check_electron_deps() {
    # häufig fehlende Shared-Libs für Electron
    local missing=()
    for lib in libXtst libnss3; do
        if ! ldconfig -p 2>/dev/null | grep -q "$lib"; then
            missing+=("$lib")
        fi
    done

    if [[ ${#missing[@]} -gt 0 ]]; then
        warn "Möglicherweise fehlende Electron-Libs: ${missing[*]}"
        warn "Bei Problemen die passenden Pakete über deinen Paketmanager nachinstallieren"
        warn "(meist 'libxtst'/'libxtst6' und 'nss'/'libnss3')."
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

# Electron lädt sein Binary (~200 MB) in einem postinstall-Schritt und schreibt
# am Ende eine path.txt. Bricht dieser Download ab, findet vite-plugin-electron
# electron später nicht ("Unable to resolve electron" / ENOENT path.txt).
# Hier wird das geprüft und bei Bedarf einmalig nachgeholt — vor dem Start.
ensure_electron_binary() {
    cd "$TARGET_DIR"

    if node -e 'require("electron")' &>/dev/null; then
        ok "Electron-Binary vorhanden."
        return
    fi

    warn "Electron-Binary fehlt/unvollständig — Download wird nachgeholt..."
    pnpm rebuild electron || true

    if node -e 'require("electron")' &>/dev/null; then
        ok "Electron-Binary nachinstalliert."
        return
    fi

    warn "Electron-Binary konnte nicht automatisch beschafft werden."
    warn "Manueller Versuch: cd \"$TARGET_DIR\" && pnpm rebuild electron"
    warn "(Bei abgebrochenem Download hilft oft: rm -rf ~/.cache/electron, dann erneut.)"
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
            log "Erstelle Produktions-Build (Paketformat-Auswahl folgt)..."
            bash "$TARGET_DIR/scripts/build-linux.sh"
            ;;
        *)
            die "Unbekannte Aktion '$ACTION'. Nutze: dev | build"
            ;;
    esac
}

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
    ensure_electron_binary
    echo ""
    run_action
}

main