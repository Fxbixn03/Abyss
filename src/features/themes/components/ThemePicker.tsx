import type { AgentId } from '@/shared/types/agent'
import type { ThemeColors, ThemeConfig } from '@/shared/types/theme'
import { Badge } from '@/shared/components/ui/badge'
import { Icon } from '@/shared/components/Icon'
import { cn } from '@/shared/lib/utils'
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
  const activeThemeId = useThemeStore((s) => s.getActiveTheme(agentId).id)

  // customThemes referenced so the list refreshes when a custom theme is added.
  void customThemes
  const themes: ThemeConfig[] = getThemesForAgent(agentId)

  return (
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
              selected ? 'border-primary ring-1 ring-primary/40' : 'border-border',
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
              style={{ background: colors.background, borderColor: colors.border }}
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
  )
}
