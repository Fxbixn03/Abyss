#!/usr/bin/env bash
# =============================================================================
# build-linux.sh — Produktions-Build für Linux mit Paketformat-Auswahl.
#
# Distro-unabhängig: erkannt wird nur "Linux", das/die Paketformat(e) wählt der
# Entwickler in einem Auswahldialog. Die Auswahl wird als ABYSS_LINUX_TARGETS an
# `pnpm build` (electron-builder) durchgereicht.
#
# Aufruf:
#   ./scripts/build-linux.sh                 # interaktiver Dialog
#   ABYSS_LINUX_TARGETS="deb,rpm" ./scripts/build-linux.sh   # ohne Rückfrage
# =============================================================================

set -euo pipefail

# --- colors & logging --------------------------------------------------------
YELLOW='\033[1;33m'; GREEN='\033[0;32m'; CYAN='\033[0;36m'; BOLD='\033[1m'; RESET='\033[0m'
log()  { echo -e "${CYAN}[INFO]${RESET}  $*"; }
ok()   { echo -e "${GREEN}[OK]${RESET}    $*"; }
warn() { echo -e "${YELLOW}[WARN]${RESET}  $*" >&2; }

# Projektwurzel = Verzeichnis über diesem Skript.
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

# pnpm aus PATH bevorzugen, sonst bekannte Installationsorte abklappern.
find_pnpm() {
    local c
    for c in "$(command -v pnpm 2>/dev/null)" /usr/local/bin/pnpm "$HOME/.local/bin/pnpm" "$HOME/.local/share/pnpm/pnpm"; do
        [[ -n "$c" && -x "$c" ]] && { echo "$c"; return 0; }
    done
    return 1
}

# Lässt den Entwickler die Linux-Paketformate wählen und gibt sie als
# komma-separierte Liste auf stdout aus (für ABYSS_LINUX_TARGETS).
#
# Nicht-interaktiv überschreibbar: ist ABYSS_LINUX_TARGETS gesetzt (CI) oder
# läuft kein TTY, wird ohne Rückfrage dieser Wert bzw. AppImage genutzt.
select_linux_targets() {
    if [[ -n "${ABYSS_LINUX_TARGETS:-}" ]]; then
        echo "$ABYSS_LINUX_TARGETS"
        return
    fi
    if [[ ! -t 0 ]]; then
        echo "AppImage"
        return
    fi

    local -a keys=(AppImage deb rpm pacman)
    local -a labels=(
        "AppImage      — portabel, jede Distro, keine Extra-Tools"
        "deb           — apt (Debian/Ubuntu/Mint), braucht dpkg+fakeroot"
        "rpm           — dnf/zypper (Fedora/RHEL/openSUSE), braucht rpmbuild"
        "pacman        — .pkg.tar.zst (Arch/CachyOS/Manjaro), braucht fakeroot"
    )
    local -a chosen=(1 0 0 0)   # AppImage vorausgewählt

    {
        echo ""
        echo -e "${BOLD}Welche Paketformate sollen gebaut werden?${RESET}"
        echo "Nummer eingeben zum Umschalten, leere Eingabe = fertig."
    } >&2

    while true; do
        {
            echo ""
            local i
            for i in "${!keys[@]}"; do
                local mark=" "
                [[ "${chosen[$i]}" -eq 1 ]] && mark="x"
                printf "  [%s] %d) %s\n" "$mark" "$((i + 1))" "${labels[$i]}"
            done
            printf "Auswahl umschalten (1-%d) oder Enter: " "${#keys[@]}"
        } >&2

        local input
        read -r input || true
        [[ -z "$input" ]] && break
        if [[ "$input" =~ ^[0-9]+$ ]] && (( input >= 1 && input <= ${#keys[@]} )); then
            local idx=$((input - 1))
            chosen[$idx]=$(( 1 - chosen[$idx] ))
        else
            warn "Ungültige Eingabe: '$input'"
        fi
    done

    local -a selected=()
    local i
    for i in "${!keys[@]}"; do
        [[ "${chosen[$i]}" -eq 1 ]] && selected+=("${keys[$i]}")
    done
    [[ ${#selected[@]} -eq 0 ]] && selected=(AppImage)

    local IFS=,
    echo "${selected[*]}"
}

main() {
    cd "$ROOT_DIR"

    local pnpm_bin
    pnpm_bin="$(find_pnpm)" || { warn "pnpm nicht gefunden (PATH oder bekannte Orte)."; exit 127; }

    local targets
    targets="$(select_linux_targets)"
    log "Erstelle Produktions-Build (Targets: ${targets})..."
    ABYSS_LINUX_TARGETS="$targets" "$pnpm_bin" build
    ok "Build fertig. Ausgabe: $ROOT_DIR/release/"
    ls -lh "$ROOT_DIR/release/"* 2>/dev/null || true
}

main
