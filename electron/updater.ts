/**
 * Auto-update wiring around electron-updater. The update feed is GitHub Releases
 * (configured in electron-builder.config.cjs `publish`). Progress is pushed to
 * the renderer via the typed event bus; the user opts into download + install.
 *
 * Only active in packaged builds — in dev there is no update metadata.
 */

import { autoUpdater } from 'electron-updater'
import { IpcEvent } from '@/shared/types/ipc'
import type { Emitter } from './ipc/emit'

let wired = false

export function setupAutoUpdater(emit: Emitter, isDev: boolean): void {
  if (isDev || wired) return
  wired = true

  // The user decides when to download and when to restart.
  autoUpdater.autoDownload = false
  autoUpdater.autoInstallOnAppQuit = true

  autoUpdater.on('checking-for-update', () =>
    emit(IpcEvent.UpdateStatus, { state: 'checking' }),
  )
  autoUpdater.on('update-available', (info) =>
    emit(IpcEvent.UpdateStatus, { state: 'available', version: info.version }),
  )
  autoUpdater.on('update-not-available', () =>
    emit(IpcEvent.UpdateStatus, { state: 'not-available' }),
  )
  autoUpdater.on('download-progress', (p) =>
    emit(IpcEvent.UpdateStatus, {
      state: 'downloading',
      percent: Math.round(p.percent),
    }),
  )
  autoUpdater.on('update-downloaded', (info) =>
    emit(IpcEvent.UpdateStatus, { state: 'downloaded', version: info.version }),
  )
  autoUpdater.on('error', (err) =>
    emit(IpcEvent.UpdateStatus, {
      state: 'error',
      message: err instanceof Error ? err.message : String(err),
    }),
  )

  // Silent check on launch; the renderer surfaces the result.
  void autoUpdater.checkForUpdates().catch(() => undefined)
}

export async function checkForUpdates(): Promise<{
  ok: boolean
  error?: string
}> {
  try {
    await autoUpdater.checkForUpdates()
    return { ok: true }
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    }
  }
}

export async function downloadUpdate(): Promise<{
  ok: boolean
  error?: string
}> {
  try {
    await autoUpdater.downloadUpdate()
    return { ok: true }
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    }
  }
}

export function quitAndInstall(): void {
  autoUpdater.quitAndInstall()
}
