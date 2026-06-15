// electron-builder configuration.
// Linux  -> AppImage by default; override via ABYSS_LINUX_TARGETS (see below)
// Windows -> NSIS installer + portable .exe
// macOS  -> DMG + zip (x64 + arm64)

// Linux build targets are distro-agnostic: we only detect "this is Linux" and
// let the developer pick the package format(s). Selection comes in via the
// ABYSS_LINUX_TARGETS env var (comma/space separated), e.g.
//   ABYSS_LINUX_TARGETS="AppImage,deb,rpm,pacman" pnpm build
// Supported: AppImage (portable), deb (apt), rpm (dnf/zypper), pacman (.pkg.tar.zst).
// Building deb/rpm/pacman requires the matching host tools (dpkg+fakeroot / rpm /
// fakeroot); AppImage needs none. Defaults to AppImage when unset.
const SUPPORTED_LINUX_TARGETS = ['AppImage', 'deb', 'rpm', 'pacman']

function resolveLinuxTargets() {
  const raw = (process.env.ABYSS_LINUX_TARGETS || '').trim()
  if (!raw) return ['AppImage']
  const requested = raw
    .split(/[\s,]+/)
    .map((t) => t.trim())
    .filter(Boolean)
  // Match case-insensitively but emit electron-builder's canonical names.
  const resolved = []
  for (const t of requested) {
    const match = SUPPORTED_LINUX_TARGETS.find(
      (s) => s.toLowerCase() === t.toLowerCase(),
    )
    if (!match) {
      throw new Error(
        `Unknown ABYSS_LINUX_TARGETS entry "${t}". Supported: ${SUPPORTED_LINUX_TARGETS.join(', ')}`,
      )
    }
    if (!resolved.includes(match)) resolved.push(match)
  }
  return resolved.length ? resolved : ['AppImage']
}

/** @type {import('electron-builder').Configuration} */
const config = {
  appId: 'dev.abyss.app',
  productName: 'Abyss',
  copyright: 'Copyright © 2026 Fxbixn03',
  directories: {
    output: 'release/${version}',
    buildResources: 'resources',
  },
  // Only the compiled app ships inside the package.
  files: ['dist/**', 'dist-electron/**', 'package.json'],
  asar: true,
  removePackageScripts: true,
  linux: {
    target: resolveLinuxTargets(),
    category: 'Development',
    synopsis: 'Unified configuration UI for AI coding agents',
    icon: 'resources/icon.png',
    artifactName: '${productName}-${version}-${arch}.${ext}',
  },
  win: {
    target: [
      { target: 'nsis', arch: ['x64'] },
      { target: 'portable', arch: ['x64'] },
    ],
    icon: 'resources/icon.ico',
    artifactName: '${productName}-${version}-${arch}.${ext}',
  },
  mac: {
    target: [
      { target: 'dmg', arch: ['x64', 'arm64'] },
      { target: 'zip', arch: ['x64', 'arm64'] },
    ],
    category: 'public.app-category.developer-tools',
    icon: 'resources/icon.png',
    artifactName: '${productName}-${version}-${arch}.${ext}',
  },
  nsis: {
    oneClick: false,
    perMachine: false,
    allowToChangeInstallationDirectory: true,
    deleteAppDataOnUninstall: false,
    // Disambiguate from the portable target (both default to the same name).
    artifactName: '${productName}-${version}-${arch}-setup.${ext}',
  },
  portable: {
    artifactName: '${productName}-${version}-${arch}-portable.${ext}',
  },
  publish: {
    provider: 'github',
    owner: 'Fxbixn03',
    repo: 'Abyss',
  },
}

module.exports = config
