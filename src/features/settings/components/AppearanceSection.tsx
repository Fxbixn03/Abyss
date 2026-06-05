import type { AppearanceMode } from '@/shared/types/theme'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/shared/components/ui/card'
import { Icon } from '@/shared/components/Icon'
import { cn } from '@/shared/lib/utils'
import { useActiveAgent } from '@/features/agents/hooks/useActiveAgent'
import { ThemePicker } from '@/features/themes/components/ThemePicker'
import { useThemeStore } from '@/features/themes/store/theme.store'

const MODES: { mode: AppearanceMode; icon: string }[] = [
  { mode: 'light', icon: 'sun' },
  { mode: 'dark', icon: 'moon' },
]

export function AppearanceSection() {
  const appearance = useThemeStore((s) => s.appearance)
  const setAppearance = useThemeStore((s) => s.setAppearance)
  const agent = useActiveAgent()

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle>Appearance</CardTitle>
          <CardDescription>
            Light or dark, applied across the whole app.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="inline-flex gap-1 rounded-lg border border-border p-1">
            {MODES.map(({ mode, icon }) => (
              <button
                key={mode}
                type="button"
                onClick={() => setAppearance(mode)}
                className={cn(
                  'flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium capitalize transition-colors',
                  appearance === mode
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
                )}
              >
                <Icon name={icon} className="size-4" />
                {mode}
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Color theme — {agent.displayName}</CardTitle>
          <CardDescription>
            Each agent remembers its own theme. Switching agents re-themes the
            app instantly.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ThemePicker agentId={agent.id} />
        </CardContent>
      </Card>
    </div>
  )
}
