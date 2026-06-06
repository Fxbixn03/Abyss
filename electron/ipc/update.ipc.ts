import { IpcChannel } from '@/shared/types/ipc'
import { checkForUpdates, downloadUpdate, quitAndInstall } from '../updater'
import { handle } from './handle'

export function registerUpdateIpc(): void {
  handle(IpcChannel.UpdateCheck, () => checkForUpdates())
  handle(IpcChannel.UpdateDownload, () => downloadUpdate())
  handle(IpcChannel.UpdateInstall, () => {
    quitAndInstall()
    return { ok: true }
  })
}
