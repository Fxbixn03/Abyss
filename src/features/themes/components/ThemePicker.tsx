import { useCallback, useState } from 'react'
import type { AgentId } from '@/shared/types/agent'
import type { ThemeConfig } from '@/shared/types/theme'
import { Badge } from '@/shared/components/ui/badge'
import { Button } from '@/shared/components/ui/button'
import { Icon } from '@/shared/components/Icon'
import { cn } from '@/shared/lib/utils'
import { ipc } from '@/shared/ipc/ipc.client'
import { applyTheme } from '../lib/applyTheme'
import { useThemeStore } from '../store/theme.store'
import { ThemePreview } from './ThemePreview'

/**
 * Per-agent theme selector. Lists every theme available to the agent (its own +
 * global), previews swatches in the current appearance, and applies instantly.
 */
export function ThemePicker({ agentId }: { agentId: AgentId }) {
  const appearance = useThemeStore((s) => s.appearance)
  const customThemes = useThemeStore((s) => s.customThemes)
  const getThemesForAgent = useThemeStore((s) => s.getThemesForAgent)
  const allThemes = useThemeStore((s) => s.allThemes)
  const setAgentTheme = useThemeStore((s) => s.setAgentTheme)
  const addCustomTheme = useThemeStore((s) => s.addCustomTheme)
  const deleteTheme = useThemeStore((s) => s.deleteTheme)
  const restoreDefaults = useThemeStore((s) => s.restoreDefaults)
  const activeTheme = useThemeStore((s) => s.getActiveTheme(agentId))
  const activeThemeId = activeTheme.id

  const [notice, setNotice] = useState<string | null>(null)
  void customThemes
  const canDelete = allThemes().length > 1
  const themes: ThemeConfig[] = getThemesForAgent(agentId)

  const restoreActiveTheme = useCallback(() => {
    applyTheme(activeTheme, appearance)
  }, [activeTheme, appearance])

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
    if (canDelete) deleteTheme(activeThemeId)
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
        <Button
          variant="ghost"
          size="sm"
          onClick={deleteActive}
          disabled={!canDelete}
        >
          <Icon name="trash" />
          Delete current
        </Button>
        <Button variant="ghost" size="sm" onClick={restoreDefaults}>
          <Icon name="rotate-ccw" />
          Restore defaults
        </Button>
        {notice && (
          <span className="truncate text-xs text-muted-foreground">
            {notice}
          </span>
        )}
      </div>

      <div
        className="grid grid-cols-1 gap-3 sm:grid-cols-2"
        onMouseLeave={restoreActiveTheme}
      >
        {themes.map((theme) => {
          const selected = theme.id === activeThemeId
          return (
            <button
              key={theme.id}
              type="button"
              onMouseEnter={() => applyTheme(theme, appearance)}
              onClick={() => setAgentTheme(agentId, theme.id)}
              className={cn(
                'flex flex-col gap-2 rounded-lg border p-3 text-left transition-colors hover:border-primary/50',
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
              <ThemePreview theme={theme} variant={appearance} />
            </button>
          )
        })}
      </div>
    </div>
  )
}
