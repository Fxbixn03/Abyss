import { dialog, shell } from 'electron'
import { IpcChannel } from '@/shared/types/ipc'
import { detectAgentPaths } from '@core/agent-paths'
import { pathExists, ensureDir } from '@core/json-file'
import { resolveScopedPath } from '@core/path-scope'
import { logError } from '../log'
import { watchFile, unwatchFile } from '../fs-watcher'
import { handle } from './handle'
import type { IpcContext } from './context'

export function registerFilesystemIpc(ctx: IpcContext): void {
  // Defense-in-depth: confine renderer-supplied paths to Abyss's allowed roots
  // (home / app-data / userData) before any disk access. Returns the resolved
  // path, or null when the path is malformed or escapes those roots.
  const scope = (p: string): string | null =>
    resolveScopedPath(p, ctx.env, ctx.userData)

  handle(IpcChannel.ResolvePaths, ({ agentId }) =>
    detectAgentPaths(agentId, ctx.env),
  )

  handle(IpcChannel.FileExists, async ({ path }) => {
    const safe = scope(path)
    if (!safe) {
      logError('FileExists: rejected out-of-scope path', path)
      return { exists: false }
    }
    return { exists: await pathExists(safe) }
  })

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
    const safe = scope(path)
    if (!safe) {
      logError('FsWatch: rejected out-of-scope path', path)
      return { ok: false }
    }
    watchFile(safe)
    return { ok: true }
  })
  handle(IpcChannel.FsUnwatch, ({ path }) => {
    const safe = scope(path)
    if (!safe) {
      logError('FsUnwatch: rejected out-of-scope path', path)
      return { ok: false }
    }
    unwatchFile(safe)
    return { ok: true }
  })

  handle(IpcChannel.CreateDirectory, async ({ path }) => {
    const safe = scope(path)
    if (!safe) {
      logError('CreateDirectory: rejected out-of-scope path', path)
      return { success: false }
    }
    await ensureDir(safe)
    return { success: true }
  })
}
