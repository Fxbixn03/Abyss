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
import {
  type UiFontSize,
  FONT_SCALE_MIN,
  FONT_SCALE_MAX,
} from '@/features/themes/lib/applyFontSize'
import { useSettingsStore } from '../store/settings.store'

/** Mid-range default when the user first switches to a custom font size. */
const FONT_SCALE_DEFAULT = 14

const MODES: { mode: AppearanceMode; icon: string }[] = [
  { mode: 'light', icon: 'sun' },
  { mode: 'dark', icon: 'moon' },
]

const FONT_SIZES: { size: UiFontSize; label: string }[] = [
  { size: 'tiny', label: 'Tiny' },
  { size: 'small', label: 'Small' },
  { size: 'medium', label: 'Medium' },
  { size: 'large', label: 'Large' },
  { size: 'huge', label: 'Huge' },
]

export function AppearanceSection() {
  const appearance = useThemeStore((s) => s.appearance)
  const setAppearance = useThemeStore((s) => s.setAppearance)
  const fontSize = useSettingsStore((s) => s.settings.uiFontSize ?? 'medium')
  const customPx = useSettingsStore((s) => s.settings.uiFontScalePx)
  const updatePrefs = useSettingsStore((s) => s.updatePrefs)
  const agent = useActiveAgent()
  const customActive = customPx !== undefined

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
          <CardTitle>Font size</CardTitle>
          <CardDescription>
            Base UI text size, applied across the whole app.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <div className="inline-flex flex-wrap gap-1 rounded-lg border border-border p-1">
            {FONT_SIZES.map(({ size, label }) => (
              <button
                key={size}
                type="button"
                // Selecting a preset clears any custom px override.
                onClick={() =>
                  void updatePrefs({
                    uiFontSize: size,
                    uiFontScalePx: undefined,
                  })
                }
                className={cn(
                  'flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
                  !customActive && fontSize === size
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
                )}
              >
                {label}
              </button>
            ))}
            <button
              type="button"
              onClick={() =>
                void updatePrefs({
                  uiFontScalePx: customPx ?? FONT_SCALE_DEFAULT,
                })
              }
              className={cn(
                'flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
                customActive
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
              )}
            >
              Custom
            </button>
          </div>

          {customActive && (
            <div className="flex items-center gap-3">
              <input
                type="range"
                min={FONT_SCALE_MIN}
                max={FONT_SCALE_MAX}
                step={1}
                value={customPx ?? FONT_SCALE_DEFAULT}
                onChange={(e) =>
                  void updatePrefs({ uiFontScalePx: Number(e.target.value) })
                }
                className="h-2 flex-1 cursor-pointer accent-primary"
                aria-label="Custom base font size"
              />
              <span className="w-14 shrink-0 text-right font-code text-sm tabular-nums">
                {customPx ?? FONT_SCALE_DEFAULT}px
              </span>
            </div>
          )}
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
