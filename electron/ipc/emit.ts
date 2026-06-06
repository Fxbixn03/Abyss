import type { BrowserWindow } from 'electron'
import type { IpcEvent, IpcEventMap } from '@/shared/types/ipc'

export type Emitter = <E extends IpcEvent>(
  event: E,
  payload: IpcEventMap[E],
) => void

/**
 * Builds the typed main → renderer push function. Mirrors {@link handle} for the
 * event direction: payload shape is inferred from {@link IpcEventMap}, and it
 * no-ops safely if the window has gone away.
 */
export function createEmitter(getWindow: () => BrowserWindow | null): Emitter {
  return (event, payload) => {
    const win = getWindow()
    if (!win || win.isDestroyed()) return
    win.webContents.send(event, payload)
  }
}
