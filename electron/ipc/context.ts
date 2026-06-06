import type { BrowserWindow } from 'electron'
import type { OsEnv } from '@/shared/types/agent'
import type { SettingsStore } from '@core/settings-store'
import type { Emitter } from './emit'

/** Dependencies handed to every IPC handler group. */
export interface IpcContext {
  env: OsEnv
  settings: SettingsStore
  /** Electron userData dir, for resolving default storage locations. */
  userData: string
  getWindow: () => BrowserWindow | null
  /** Typed main → renderer push (streaming events). */
  emit: Emitter
}
