#!/usr/bin/env bash
# Deploy the freshly built AppImage to ~/Applications.
#
# The version is read from package.json so the path always matches what
# `pnpm build` just produced (electron-builder writes to release/<version>/).
# Hard-coding the version here was the bug that kept deploying a stale build.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

VERSION="$(node -p "require('./package.json').version")"
DEST="${HOME}/Applications/Abyss.AppImage"

# electron-builder names the AppImage after the build arch (x86_64 / arm64 / …),
# which varies by the distro/machine we build on. Just take whatever AppImage
# the build for this version produced instead of hard-coding an arch.
shopt -s nullglob
CANDIDATES=("release/${VERSION}"/Abyss-${VERSION}-*.AppImage)
shopt -u nullglob

if [[ ${#CANDIDATES[@]} -eq 0 ]]; then
  echo "Deploy failed: no AppImage found in release/${VERSION}/" >&2
  echo "Did the build for version ${VERSION} succeed?" >&2
  exit 1
fi

if [[ ${#CANDIDATES[@]} -gt 1 ]]; then
  echo "Note: multiple AppImages found for ${VERSION}, deploying the first:" >&2
  printf '  %s\n' "${CANDIDATES[@]}" >&2
fi

SRC="${CANDIDATES[0]}"

mkdir -p "$(dirname "$DEST")"

# Atomic replace: copy to a temp file, then rename over the target. A running
# instance keeps its old inode; the next launch opens the new one cleanly.
cp "$SRC" "${DEST}.tmp"
chmod +x "${DEST}.tmp"
mv -f "${DEST}.tmp" "$DEST"

echo "Deployed ${SRC} -> ${DEST}"
