import { dialog, shell } from 'electron'
import { IpcChannel } from '@/shared/types/ipc'
import { detectAgentPaths } from '@core/agent-paths'
import { pathExists } from '@core/json-file'
import { watchFile, unwatchFile } from '../fs-watcher'
import { handle } from './handle'
import type { IpcContext } from './context'

export function registerFilesystemIpc(ctx: IpcContext): void {
  handle(IpcChannel.ResolvePaths, ({ agentId }) =>
    detectAgentPaths(agentId, ctx.env),
  )

  handle(IpcChannel.FileExists, async ({ path }) => ({
    exists: await pathExists(path),
  }))

  handle(IpcChannel.PickDirectory, async ({ title, defaultPath }) => {
    const window = ctx.getWindow()
    const result = await (window
      ? dialog.showOpenDialog(window, {
          title,
          defaultPath,
          properties: ['openDirectory', 'createDirectory'],
        })
      : dialog.showOpenDialog({
          title,
          defaultPath,
          properties: ['openDirectory', 'createDirectory'],
        }))
    if (result.canceled || result.filePaths.length === 0) {
      return { path: null }
    }
    return { path: result.filePaths[0] }
  })

  handle(IpcChannel.PickFile, async ({ title, defaultPath, filters }) => {
    const window = ctx.getWindow()
    const options = {
      title,
      defaultPath,
      filters,
      properties: ['openFile' as const],
    }
    const result = await (window
      ? dialog.showOpenDialog(window, options)
      : dialog.showOpenDialog(options))
    if (result.canceled || result.filePaths.length === 0) {
      return { path: null }
    }
    return { path: result.filePaths[0] }
  })

  handle(IpcChannel.RevealPath, async ({ path }) => {
    if (!(await pathExists(path))) return { success: false }
    // Reveal the item in the OS file manager (works for files and dirs).
    shell.showItemInFolder(path)
    return { success: true }
  })

  handle(IpcChannel.OpenExternal, async ({ url }) => {
    // Only hand safe web/mail schemes to the OS — never file:// or custom ones.
    if (!/^(https?|mailto):/i.test(url)) return { success: false }
    await shell.openExternal(url)
    return { success: true }
  })

  handle(IpcChannel.FsWatch, ({ path }) => {
    watchFile(path)
    return { ok: true }
  })
  handle(IpcChannel.FsUnwatch, ({ path }) => {
    unwatchFile(path)
    return { ok: true }
  })
}
