import { promises as fs } from 'node:fs'
import { dialog } from 'electron'
import { IpcChannel } from '@/shared/types/ipc'
import type { ThemeColors, ThemeConfig } from '@/shared/types/theme'
import { handle } from './handle'
import type { IpcContext } from './context'

const COLOR_KEYS: (keyof ThemeColors)[] = [
  'primary',
  'primaryForeground',
  'background',
  'surface',
  'border',
  'text',
  'textMuted',
  'sidebar',
  'sidebarActive',
]

function isColors(value: unknown): value is ThemeColors {
  if (!value || typeof value !== 'object') return false
  const c = value as Record<string, unknown>
  return COLOR_KEYS.every((k) => typeof c[k] === 'string')
}

function isThemeConfig(value: unknown): value is ThemeConfig {
  if (!value || typeof value !== 'object') return false
  const t = value as Record<string, unknown>
  return (
    typeof t.id === 'string' &&
    typeof t.label === 'string' &&
    typeof t.agentId === 'string' &&
    typeof t.borderRadius === 'string' &&
    typeof t.fontFamily === 'string' &&
    isColors(t.light) &&
    isColors(t.dark)
  )
}

export function registerThemeIpc(ctx: IpcContext): void {
  handle(IpcChannel.ThemeExport, async ({ theme, suggestedName }) => {
    const window = ctx.getWindow()
    const safe = suggestedName.replace(/[^\w.-]+/g, '-').slice(0, 60) || 'theme'
    const options = {
      title: 'Export Theme',
      defaultPath: `${safe}.theme.json`,
      filters: [{ name: 'Abyss Theme', extensions: ['json'] }],
    }
    const result = await (window
      ? dialog.showSaveDialog(window, options)
      : dialog.showSaveDialog(options))
    if (result.canceled || !result.filePath) return { path: null }
    await fs.writeFile(
      result.filePath,
      `${JSON.stringify(theme, null, 2)}\n`,
      'utf8',
    )
    return { path: result.filePath }
  })

  handle(IpcChannel.ThemeImport, async () => {
    const window = ctx.getWindow()
    const options = {
      title: 'Import Theme',
      filters: [{ name: 'Abyss Theme', extensions: ['json'] }],
      properties: ['openFile' as const],
    }
    const result = await (window
      ? dialog.showOpenDialog(window, options)
      : dialog.showOpenDialog(options))
    if (result.canceled || result.filePaths.length === 0) {
      return { theme: null }
    }
    try {
      const parsed: unknown = JSON.parse(
        await fs.readFile(result.filePaths[0], 'utf8'),
      )
      if (!isThemeConfig(parsed)) {
        return { theme: null, error: 'Not a valid Abyss theme file.' }
      }
      return { theme: parsed }
    } catch {
      return { theme: null, error: 'Could not read the theme file.' }
    }
  })
}
