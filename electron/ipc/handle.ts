import { ipcMain } from 'electron'
import type { IpcChannel, IpcMap } from '@/shared/types/ipc'
import { encodeIpcError } from '@/shared/ipc/ipc-error'
import { logError } from '../log'

/**
 * Type-safe wrapper around `ipcMain.handle`. The handler's payload and return
 * type are inferred from {@link IpcMap}, so a channel can never be wired to the
 * wrong shape.
 *
 * Thrown errors are logged and re-encoded so the renderer can decode a typed
 * {@link IpcError} (preserving `code`/`filePath`), instead of receiving an
 * opaque "Error invoking remote method" string.
 */
export function handle<C extends IpcChannel>(
  channel: C,
  handler: (
    payload: IpcMap[C]['request'],
  ) => Promise<IpcMap[C]['response']> | IpcMap[C]['response'],
): void {
  ipcMain.handle(channel, async (_event, payload: IpcMap[C]['request']) => {
    try {
      return await handler(payload)
    } catch (err) {
      logError(`IPC ${channel} failed`, err)
      throw new Error(encodeIpcError(err), { cause: err })
    }
  })
}
