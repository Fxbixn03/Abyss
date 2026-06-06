import { useState } from 'react'
import type { AgentId } from '@/shared/types/agent'
import type { ThemeColors, ThemeConfig } from '@/shared/types/theme'
import { Badge } from '@/shared/components/ui/badge'
import { Button } from '@/shared/components/ui/button'
import { Icon } from '@/shared/components/Icon'
import { cn } from '@/shared/lib/utils'
import { ipc } from '@/shared/ipc/ipc.client'
import { useThemeStore } from '../store/theme.store'

function Swatches({ colors }: { colors: ThemeColors }) {
  const keys: (keyof ThemeColors)[] = [
    'background',
    'surface',
    'sidebar',
    'primary',
    'border',
  ]
  return (
    <div className="flex gap-1">
      {keys.map((key) => (
        <span
          key={key}
          className="size-5 rounded-full border border-black/10"
          style={{ background: colors[key] }}
          title={`${key}: ${colors[key]}`}
        />
      ))}
    </div>
  )
}

/**
 * Per-agent theme selector. Lists every theme available to the agent (its own +
 * global), previews swatches in the current appearance, and applies instantly.
 */
export function ThemePicker({ agentId }: { agentId: AgentId }) {
  const appearance = useThemeStore((s) => s.appearance)
  const customThemes = useThemeStore((s) => s.customThemes)
  const getThemesForAgent = useThemeStore((s) => s.getThemesForAgent)
  const setAgentTheme = useThemeStore((s) => s.setAgentTheme)
  const addCustomTheme = useThemeStore((s) => s.addCustomTheme)
  const removeCustomTheme = useThemeStore((s) => s.removeCustomTheme)
  const activeTheme = useThemeStore((s) => s.getActiveTheme(agentId))
  const activeThemeId = activeTheme.id

  const [notice, setNotice] = useState<string | null>(null)
  const isCustom = customThemes.some((t) => t.id === activeThemeId)
  const themes: ThemeConfig[] = getThemesForAgent(agentId)

  const exportActive = async () => {
    const { path } = await ipc.themeExport(activeTheme, activeTheme.id)
    if (path) setNotice(`Exported “${activeTheme.label}” to ${path}`)
  }

  const importTheme = async () => {
    setNotice(null)
    const { theme, error } = await ipc.themeImport()
    if (error) {
      setNotice(error)
      return
    }
    if (theme) {
      addCustomTheme(theme)
      if (theme.agentId === agentId || theme.agentId === '*') {
        setAgentTheme(agentId, theme.id)
      }
      setNotice(`Imported “${theme.label}”.`)
    }
  }

  const deleteActive = () => {
    if (isCustom) removeCustomTheme(activeThemeId)
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="outline" size="sm" onClick={() => void importTheme()}>
          <Icon name="download" />
          Import theme
        </Button>
        <Button variant="outline" size="sm" onClick={() => void exportActive()}>
          <Icon name="upload" />
          Export current
        </Button>
        {isCustom && (
          <Button variant="ghost" size="sm" onClick={deleteActive}>
            <Icon name="trash" />
            Delete current
          </Button>
        )}
        {notice && (
          <span className="truncate text-xs text-muted-foreground">
            {notice}
          </span>
        )}
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {themes.map((theme) => {
          const selected = theme.id === activeThemeId
          const colors = appearance === 'light' ? theme.light : theme.dark
          return (
            <button
              key={theme.id}
              type="button"
              onClick={() => setAgentTheme(agentId, theme.id)}
              className={cn(
                'flex flex-col gap-3 rounded-lg border p-3 text-left transition-colors hover:border-primary/50',
                selected
                  ? 'border-primary ring-1 ring-primary/40'
                  : 'border-border',
              )}
            >
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">{theme.label}</span>
                {selected ? (
                  <Icon name="circle-check" className="size-4 text-primary" />
                ) : theme.agentId === '*' ? (
                  <Badge variant="muted">global</Badge>
                ) : null}
              </div>
              <div
                className="rounded-md border p-3"
                style={{
                  background: colors.background,
                  borderColor: colors.border,
                }}
              >
                <Swatches colors={colors} />
              </div>
              <span className="font-code text-[11px] text-muted-foreground">
                {theme.borderRadius} · {theme.fontFamily}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
