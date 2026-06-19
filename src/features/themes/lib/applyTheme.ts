import type {
  AppearanceMode,
  FontFamily,
  ThemeConfig,
} from '@/shared/types/theme'

export const RADIUS_PX: Record<ThemeConfig['borderRadius'], string> = {
  none: '0px',
  sm: '0.25rem',
  md: '0.5rem',
  lg: '0.75rem',
}

export const SANS_STACK =
  "'Inter', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif"
export const MONO_STACK =
  "'JetBrains Mono', 'SFMono-Regular', 'Fira Code', ui-monospace, 'Cascadia Code', monospace"

/**
 * Font-family registry. Each entry is a full CSS stack with robust system
 * fallbacks — no web fonts are loaded, so unavailable faces degrade gracefully
 * to a native equivalent. `mixed` is kept as an alias of `sans` for backwards
 * compatibility with themes authored before the expanded font set.
 */
export const FONT_STACKS: Record<FontFamily, string> = {
  mono: MONO_STACK,
  sans: SANS_STACK,
  mixed: SANS_STACK,
  system: "system-ui, -apple-system, 'Segoe UI', Roboto, Helvetica, sans-serif",
  serif:
    "'Iowan Old Style', 'Palatino Linotype', Palatino, Georgia, Cambria, 'Times New Roman', serif",
  rounded:
    "'SF Pro Rounded', 'Nunito', 'Varela Round', 'Segoe UI', system-ui, sans-serif",
  grotesk:
    "'Space Grotesk', 'Eurostile', 'Avenir Next', 'Segoe UI', system-ui, sans-serif",
  humanist:
    "'Optima', 'Gill Sans', 'Segoe UI', Candara, 'Trebuchet MS', sans-serif",
}

/** Human-readable labels for the font picker, in display order. */
export const FONT_LABELS: Record<FontFamily, string> = {
  sans: 'Sans (Inter)',
  mono: 'Mono (JetBrains)',
  mixed: 'Mixed',
  system: 'System',
  serif: 'Serif',
  rounded: 'Rounded',
  grotesk: 'Grotesk',
  humanist: 'Humanist',
}

export function fontStack(family: FontFamily): string {
  return FONT_STACKS[family] ?? SANS_STACK
}

/**
 * Applies a theme as CSS custom properties on :root. Because every Tailwind /
 * shadcn token maps to these vars (see index.css `@theme inline`), the whole UI
 * re-themes instantly — no reload, no component touched.
 */
export function applyTheme(
  theme: ThemeConfig,
  appearance: AppearanceMode,
): void {
  const c = appearance === 'light' ? theme.light : theme.dark
  const root = document.documentElement

  const vars: Record<string, string> = {
    '--background': c.background,
    '--foreground': c.text,
    '--card': c.surface,
    '--card-foreground': c.text,
    '--popover': c.surface,
    '--popover-foreground': c.text,
    '--primary': c.primary,
    '--primary-foreground': c.primaryForeground,
    '--secondary': c.surface,
    '--secondary-foreground': c.text,
    '--muted': c.surface,
    '--muted-foreground': c.textMuted,
    '--accent': c.sidebarActive,
    '--accent-foreground': c.text,
    '--border': c.border,
    '--input': c.border,
    '--ring': c.primary,
    '--sidebar': c.sidebar,
    '--sidebar-foreground': c.text,
    '--sidebar-accent': c.sidebarActive,
    '--sidebar-accent-foreground': c.text,
    '--sidebar-border': c.border,
    '--destructive': c.danger ?? '#e5484d',
    '--destructive-foreground': '#ffffff',
    '--success': c.success ?? '#30a46c',
    '--warning': c.warning ?? '#f5a524',
    '--radius': RADIUS_PX[theme.borderRadius],
    '--font-ui': fontStack(theme.fontFamily),
  }

  for (const [key, value] of Object.entries(vars)) {
    root.style.setProperty(key, value)
  }

  // Keep Tailwind's `dark` variant + native form controls in sync.
  root.classList.toggle('dark', appearance === 'dark')
  root.classList.toggle('light', appearance === 'light')
  root.style.colorScheme = appearance
}
