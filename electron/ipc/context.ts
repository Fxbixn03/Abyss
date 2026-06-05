import type { BrowserWindow } from 'electron'
import type { OsEnv } from '@/shared/types/agent'
import type { SettingsStore } from '@core/settings-store'

/** Dependencies handed to every IPC handler group. */
export interface IpcContext {
  env: OsEnv
  settings: SettingsStore
  getWindow: () => BrowserWindow | null
}
