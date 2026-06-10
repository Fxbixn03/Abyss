import { promises as fs } from 'node:fs'
import { dialog, shell } from 'electron'
import { IpcChannel } from '@/shared/types/ipc'
import { detectAgentPaths } from '@core/agent-paths'
import {
  pathExists,
  ensureDir,
  readTextFile,
  writeTextFileAtomic,
} from '@core/json-file'
import { resolveScopedPath, isWellFormedPath } from '@core/path-scope'
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
    // Reveal is read-only (opens the OS file manager) and legitimately targets
    // paths outside the allowed roots — backups in a user-chosen dir, for one —
    // so we don't root-scope it; we only reject malformed / non-existent paths.
    if (!isWellFormedPath(path)) return { success: false }
    if (!(await pathExists(path))) return { success: false }
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

  // Read any text file under the allowed roots (hook scripts, config files the
  // history diff needs, …). A missing file yields empty content + exists:false.
  handle(IpcChannel.ReadTextFile, async ({ path }) => {
    const safe = scope(path)
    if (!safe) {
      logError('ReadTextFile: rejected out-of-scope path', path)
      return { content: '', exists: false }
    }
    if (!(await pathExists(safe))) return { content: '', exists: false }
    return { content: await readTextFile(safe), exists: true }
  })

  // Write a text file under the allowed roots, through the atomic writer (so a
  // snapshot of the previous content is captured for history). `executable`
  // marks shell scripts +x so a freshly-created hook script can run.
  handle(IpcChannel.WriteTextFile, async ({ path, content, executable }) => {
    const safe = scope(path)
    if (!safe) {
      logError('WriteTextFile: rejected out-of-scope path', path)
      return { success: false, path }
    }
    await writeTextFileAtomic(safe, content)
    if (executable) await fs.chmod(safe, 0o755).catch(() => {})
    return { success: true, path: safe }
  })

  // Save content to a user-picked location (hooks export). The path comes from
  // the OS save dialog, so it isn't root-scoped — the user chose it explicitly.
  handle(
    IpcChannel.SaveTextFile,
    async ({ content, defaultName, title, filters }) => {
      const window = ctx.getWindow()
      const options = { title, defaultPath: defaultName, filters }
      const result = await (window
        ? dialog.showSaveDialog(window, options)
        : dialog.showSaveDialog(options))
      if (result.canceled || !result.filePath) return { path: null }
      await fs.writeFile(result.filePath, content, 'utf8')
      return { path: result.filePath }
    },
  )
}
