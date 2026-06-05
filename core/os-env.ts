/**
 * Builds the {@link OsEnv} used to resolve agent config locations.
 *
 * The Electron main process passes Electron's resolved paths as overrides
 * (e.g. `app.getPath('appData')`); the CLI relies on the Node defaults here.
 */

import os from 'node:os'
import path from 'node:path'
import type { OsEnv, Platform } from '@/shared/types/agent'

function appDataRoot(home: string, platform: NodeJS.Platform): string {
  if (platform === 'win32') {
    return process.env.APPDATA ?? path.join(home, 'AppData', 'Roaming')
  }
  if (platform === 'darwin') {
    return path.join(home, 'Library', 'Application Support')
  }
  return process.env.XDG_CONFIG_HOME ?? path.join(home, '.config')
}

export function resolveOsEnv(overrides: Partial<OsEnv> = {}): OsEnv {
  const home = overrides.home ?? os.homedir()
  const platform = overrides.platform ?? (process.platform as Platform)
  const appData = overrides.appData ?? appDataRoot(home, process.platform)
  return { home, appData, platform }
}
