import type { AppearanceMode, ThemeConfig } from '@/shared/types/theme'
import { RADIUS_PX, fontStack } from '../lib/applyTheme'
import { STATUS_DEFAULTS } from '../lib/builder'

const NAV = ['Dashboard', 'Agents', 'Hooks']
const STATUS: { key: 'success' | 'warning' | 'danger'; label: string }[] = [
  { key: 'success', label: 'Success' },
  { key: 'warning', label: 'Warning' },
  { key: 'danger', label: 'Danger' },
]

/** A live, self-contained mock that renders a theme without applying it. */
export function ThemePreview({
  theme,
  variant,
}: {
  theme: ThemeConfig
  variant: AppearanceMode
}) {
  const c = variant === 'light' ? theme.light : theme.dark
  const radius = RADIUS_PX[theme.borderRadius]
  const font = fontStack(theme.fontFamily)

  return (
    <div
      style={{
        background: c.background,
        color: c.text,
        fontFamily: font,
        borderColor: c.border,
      }}
      className="overflow-hidden rounded-lg border"
    >
      <div className="flex h-[240px] text-xs">
        <div
          style={{ background: c.sidebar, borderColor: c.border }}
          className="flex w-[104px] flex-col gap-1 border-r p-2"
        >
          <div className="mb-1 flex items-center gap-1.5">
            <span
              style={{
                background: c.primary,
                color: c.primaryForeground,
                borderRadius: radius,
              }}
              className="flex size-5 items-center justify-center text-[10px] font-bold"
            >
              A
            </span>
            <span className="text-[11px] font-semibold">Abyss</span>
          </div>
          {NAV.map((item, i) => (
            <div
              key={item}
              style={
                i === 0
                  ? { background: c.sidebarActive, borderRadius: radius }
                  : undefined
              }
              className="px-2 py-1 text-[10px]"
            >
              {item}
            </div>
          ))}
        </div>

        <div className="flex-1 p-3">
          <div className="mb-2 text-[11px] font-semibold">Preview</div>
          <div
            style={{
              background: c.surface,
              borderColor: c.border,
              borderRadius: radius,
            }}
            className="border p-2.5"
          >
            <div className="font-medium">Card title</div>
            <div style={{ color: c.textMuted }} className="text-[10px]">
              A muted description line.
            </div>
            <div className="mt-2 flex items-center gap-1.5">
              <span
                style={{
                  background: c.primary,
                  color: c.primaryForeground,
                  borderRadius: radius,
                }}
                className="px-2 py-1 text-[10px] font-medium"
              >
                Primary
              </span>
              <span
                style={{
                  background: c.surface,
                  color: c.text,
                  borderColor: c.border,
                  borderRadius: radius,
                }}
                className="border px-2 py-1 text-[10px]"
              >
                Secondary
              </span>
            </div>
            <div className="mt-2.5 flex gap-3">
              {STATUS.map(({ key, label }) => {
                const color = c[key] ?? STATUS_DEFAULTS[key]
                return (
                  <span
                    key={key}
                    style={{ color }}
                    className="flex items-center gap-1 text-[10px]"
                  >
                    <span
                      style={{ background: color }}
                      className="size-2 rounded-full"
                    />
                    {label}
                  </span>
                )
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
