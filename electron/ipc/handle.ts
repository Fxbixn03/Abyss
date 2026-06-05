import { ipcMain } from 'electron'
import type { IpcChannel, IpcMap } from '@/shared/types/ipc'

/**
 * Type-safe wrapper around `ipcMain.handle`. The handler's payload and return
 * type are inferred from {@link IpcMap}, so a channel can never be wired to the
 * wrong shape.
 */
export function handle<C extends IpcChannel>(
  channel: C,
  handler: (
    payload: IpcMap[C]['request'],
  ) => Promise<IpcMap[C]['response']> | IpcMap[C]['response'],
): void {
  ipcMain.handle(channel, (_event, payload: IpcMap[C]['request']) =>
    handler(payload),
  )
}
