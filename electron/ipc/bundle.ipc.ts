import { promises as fs } from 'node:fs'
import { dialog } from 'electron'
import { IpcChannel } from '@/shared/types/ipc'
import type { ExportBundle } from '@/shared/types/bundle'
import { exportBundle, applyBundle } from '@core/bundle'
import { assertScopedPath } from '@core/path-scope'
import { handle } from './handle'
import type { IpcContext } from './context'

function isExportBundle(value: unknown): value is ExportBundle {
  return (
    !!value &&
    typeof value === 'object' &&
    (value as ExportBundle).$schema === 'abyss-bundle/v1' &&
    Array.isArray((value as ExportBundle).agents)
  )
}

export function registerBundleIpc(ctx: IpcContext): void {
  handle(IpcChannel.BundlePreview, ({ agentIds }) =>
    exportBundle(ctx.env, { agentIds }),
  )

  handle(IpcChannel.BundleExportFile, async ({ agentIds }) => {
    const bundle = await exportBundle(ctx.env, { agentIds })
    const window = ctx.getWindow()
    const stamp = new Date().toISOString().slice(0, 10)
    const options = {
      title: 'Export Config Bundle',
      defaultPath: `abyss-bundle-${stamp}.json`,
      filters: [{ name: 'Abyss Bundle', extensions: ['json'] }],
    }
    const result = await (window
      ? dialog.showSaveDialog(window, options)
      : dialog.showSaveDialog(options))
    if (result.canceled || !result.filePath) return { path: null }
    await fs.writeFile(
      result.filePath,
      `${JSON.stringify(bundle, null, 2)}\n`,
      'utf8',
    )
    return { path: result.filePath }
  })

  handle(IpcChannel.BundleLoadFile, async () => {
    const window = ctx.getWindow()
    const options = {
      title: 'Open Config Bundle',
      filters: [{ name: 'Abyss Bundle', extensions: ['json'] }],
      properties: ['openFile' as const],
    }
    const result = await (window
      ? dialog.showOpenDialog(window, options)
      : dialog.showOpenDialog(options))
    if (result.canceled || result.filePaths.length === 0) {
      return { bundle: null, path: null }
    }
    const path = result.filePaths[0]
    try {
      const parsed: unknown = JSON.parse(await fs.readFile(path, 'utf8'))
      if (!isExportBundle(parsed)) return { bundle: null, path }
      return { bundle: parsed, path }
    } catch {
      return { bundle: null, path }
    }
  })

  handle(IpcChannel.BundleApply, ({ bundle, agentIds, dryRun }) => {
    const filtered: ExportBundle = agentIds
      ? {
          ...bundle,
          agents: bundle.agents.filter((a) => agentIds.includes(a.agentId)),
        }
      : bundle
    // Defense-in-depth: refuse a bundle whose per-agent basePath escapes the
    // allowed roots. A hand-edited or foreign bundle could otherwise point
    // config writes at an arbitrary directory.
    for (const agent of filtered.agents) {
      assertScopedPath(agent.basePath, ctx.env, ctx.userData)
    }
    return applyBundle(filtered, { dryRun })
  })
}
