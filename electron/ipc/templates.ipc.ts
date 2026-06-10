import { promises as fs } from 'node:fs'
import { dialog } from 'electron'
import { IpcChannel } from '@/shared/types/ipc'
import type {
  TemplatePack,
  TemplatePackItem,
} from '@/shared/types/template-pack'
import { handle } from './handle'
import type { IpcContext } from './context'

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((v) => typeof v === 'string')
}

function isPackItem(value: unknown): value is TemplatePackItem {
  if (typeof value !== 'object' || value === null) return false
  const t = value as Record<string, unknown>
  return (
    typeof t.id === 'string' &&
    typeof t.title === 'string' &&
    typeof t.description === 'string' &&
    typeof t.content === 'string' &&
    isStringArray(t.tags) &&
    (t.agentIds === undefined || isStringArray(t.agentIds))
  )
}

function isTemplatePack(value: unknown): value is TemplatePack {
  if (typeof value !== 'object' || value === null) return false
  const p = value as Record<string, unknown>
  return (
    p.kind === 'abyss-template-pack' &&
    p.version === 1 &&
    Array.isArray(p.templates) &&
    p.templates.every(isPackItem)
  )
}

export function registerTemplatesIpc(ctx: IpcContext): void {
  handle(IpcChannel.TemplatesExport, async ({ pack, suggestedName }) => {
    const window = ctx.getWindow()
    const safe =
      suggestedName.replace(/[^\w.-]+/g, '-').slice(0, 60) || 'templates'
    const options = {
      title: 'Export Prompt Templates',
      defaultPath: `${safe}.templates.json`,
      filters: [{ name: 'Abyss Template Pack', extensions: ['json'] }],
    }
    const result = await (window
      ? dialog.showSaveDialog(window, options)
      : dialog.showSaveDialog(options))
    if (result.canceled || !result.filePath) return { path: null }
    await fs.writeFile(
      result.filePath,
      `${JSON.stringify(pack, null, 2)}\n`,
      'utf8',
    )
    return { path: result.filePath }
  })

  handle(IpcChannel.TemplatesImport, async () => {
    const window = ctx.getWindow()
    const options = {
      title: 'Import Prompt Templates',
      filters: [{ name: 'Abyss Template Pack', extensions: ['json'] }],
      properties: ['openFile' as const],
    }
    const result = await (window
      ? dialog.showOpenDialog(window, options)
      : dialog.showOpenDialog(options))
    if (result.canceled || result.filePaths.length === 0) {
      return { templates: null }
    }
    try {
      const parsed: unknown = JSON.parse(
        await fs.readFile(result.filePaths[0], 'utf8'),
      )
      if (!isTemplatePack(parsed)) {
        return { templates: null, error: 'Not a valid Abyss template pack.' }
      }
      return { templates: parsed.templates }
    } catch {
      return { templates: null, error: 'Could not read the template pack.' }
    }
  })
}
