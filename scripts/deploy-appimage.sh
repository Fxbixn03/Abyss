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
SRC="release/${VERSION}/Abyss-${VERSION}-x86_64.AppImage"
DEST="${HOME}/Applications/Abyss.AppImage"

if [[ ! -f "$SRC" ]]; then
  echo "Deploy failed: expected AppImage not found: $SRC" >&2
  echo "Did the build for version ${VERSION} succeed?" >&2
  exit 1
fi

mkdir -p "$(dirname "$DEST")"

# Atomic replace: copy to a temp file, then rename over the target. A running
# instance keeps its old inode; the next launch opens the new one cleanly.
cp "$SRC" "${DEST}.tmp"
chmod +x "${DEST}.tmp"
mv -f "${DEST}.tmp" "$DEST"

echo "Deployed ${SRC} -> ${DEST}"
