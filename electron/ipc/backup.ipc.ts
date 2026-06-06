import { IpcChannel } from '@/shared/types/ipc'
import { createBackup, defaultBackupDir, listBackups } from '@core/backup'
import { handle } from './handle'
import type { IpcContext } from './context'

export function registerBackupIpc(ctx: IpcContext): void {
  const resolveDir = async (): Promise<string> => {
    const settings = await ctx.settings.read()
    return settings.backupDir || defaultBackupDir(ctx.userData)
  }

  handle(IpcChannel.BackupList, async () => listBackups(await resolveDir()))

  handle(IpcChannel.BackupRun, async () => {
    const settings = await ctx.settings.read()
    const dir = settings.backupDir || defaultBackupDir(ctx.userData)
    return createBackup(ctx.env, dir, settings.backupKeep ?? 3)
  })
}
