import type { ThemeColors, ThemeConfig } from '@/shared/types/theme'

export interface ColorFieldDef {
  key: keyof ThemeColors
  label: string
  optional?: boolean
}

export interface ColorGroup {
  title: string
  fields: ColorFieldDef[]
}

/** Grouping of editable color tokens for the builder form. */
export const COLOR_GROUPS: ColorGroup[] = [
  {
    title: 'Accent',
    fields: [
      { key: 'primary', label: 'Primary' },
      { key: 'primaryForeground', label: 'On primary' },
    ],
  },
  {
    title: 'Surfaces',
    fields: [
      { key: 'background', label: 'Background' },
      { key: 'surface', label: 'Surface / cards' },
      { key: 'border', label: 'Border' },
    ],
  },
  {
    title: 'Text',
    fields: [
      { key: 'text', label: 'Text' },
      { key: 'textMuted', label: 'Muted text' },
    ],
  },
  {
    title: 'Sidebar',
    fields: [
      { key: 'sidebar', label: 'Sidebar' },
      { key: 'sidebarActive', label: 'Active item' },
    ],
  },
  {
    title: 'Status',
    fields: [
      { key: 'success', label: 'Success', optional: true },
      { key: 'warning', label: 'Warning', optional: true },
      { key: 'danger', label: 'Danger', optional: true },
    ],
  },
]

export const STATUS_DEFAULTS: Record<string, string> = {
  success: '#30a46c',
  warning: '#f5a524',
  danger: '#e5484d',
}

export function colorValue(colors: ThemeColors, field: ColorFieldDef): string {
  return colors[field.key] ?? STATUS_DEFAULTS[field.key] ?? '#000000'
}

/** Coerce arbitrary input to a 6-digit hex acceptable to <input type=color>. */
export function normalizeHex(value: string): string {
  const v = value.trim()
  if (/^#[0-9a-fA-F]{6}$/.test(v)) return v.toLowerCase()
  if (/^#[0-9a-fA-F]{3}$/.test(v)) {
    return (
      '#' +
      v
        .slice(1)
        .split('')
        .map((c) => c + c)
        .join('')
        .toLowerCase()
    )
  }
  return '#000000'
}

export function newThemeId(): string {
  return `custom-${Math.random().toString(36).slice(2, 8)}${Date.now()
    .toString(36)
    .slice(-4)}`
}

/** A fresh editable theme seeded from an existing one. */
export function createDraftTheme(base: ThemeConfig): ThemeConfig {
  return {
    id: newThemeId(),
    label: 'My Theme',
    agentId: '*',
    light: { ...base.light },
    dark: { ...base.dark },
    borderRadius: base.borderRadius,
    fontFamily: base.fontFamily,
  }
}

export function duplicateTheme(base: ThemeConfig): ThemeConfig {
  return { ...createDraftTheme(base), label: `${base.label} Copy` }
}

export function cloneTheme(theme: ThemeConfig): ThemeConfig {
  return {
    ...theme,
    light: { ...theme.light },
    dark: { ...theme.dark },
  }
}
