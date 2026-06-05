// electron-builder configuration.
// Linux  -> AppImage (portable, no install required)
// Windows -> NSIS installer + portable .exe
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
    target: ['AppImage'],
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
  nsis: {
    oneClick: false,
    perMachine: false,
    allowToChangeInstallationDirectory: true,
    deleteAppDataOnUninstall: false,
  },
  publish: {
    provider: 'github',
    owner: 'Fxbixn03',
    repo: 'Abyss',
  },
}

module.exports = config
