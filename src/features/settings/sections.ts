/**
 * Settings section metadata, shared by the Settings page and the command
 * palette so both stay in sync and sections become searchable / deep-linkable
 * via `/settings?s=<id>`.
 */
export interface SettingsSectionMeta {
  id: string
  label: string
  icon: string
  /** Extra search terms so the palette finds a section by what it contains. */
  keywords?: string[]
}

export const SETTINGS_SECTIONS: SettingsSectionMeta[] = [
  { id: 'agents', label: 'Agents', icon: 'bot', keywords: ['enable', 'disable', 'visible'] },
  {
    id: 'paths',
    label: 'Config Paths',
    icon: 'folder',
    keywords: ['directory', 'location', 'detect'],
  },
  {
    id: 'appearance',
    label: 'Appearance',
    icon: 'palette',
    keywords: ['theme', 'dark', 'light', 'color'],
  },
  { id: 'agent-icons', label: 'Agent Icons', icon: 'bot', keywords: ['icon', 'logo'] },
  {
    id: 'theme-builder',
    label: 'Theme Builder',
    icon: 'paintbrush',
    keywords: ['custom', 'theme', 'color'],
  },
  {
    id: 'shortcuts',
    label: 'Shortcuts',
    icon: 'keyboard',
    keywords: ['keybinding', 'hotkey', 'key'],
  },
  {
    id: 'preferences',
    label: 'Preferences',
    icon: 'sliders',
    keywords: ['billing', 'cost', 'currency', 'quota', 'budget'],
  },
  {
    id: 'backups',
    label: 'Backups',
    icon: 'archive',
    keywords: ['backup', 'restore', 'auto', 'daily'],
  },
  { id: 'about', label: 'About', icon: 'info', keywords: ['version', 'update'] },
]

export const DEFAULT_SETTINGS_SECTION = 'paths'
