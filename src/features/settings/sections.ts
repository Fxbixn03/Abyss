/**
 * Settings section metadata, shared by the Settings page and the command
 * palette so both stay in sync and sections become searchable / deep-linkable
 * via `/settings?s=<id>`.
 */
export interface SettingsSectionMeta {
  id: string
  label: string
  icon: string
  /** Category bucket the section is rendered under (see SETTINGS_CATEGORIES). */
  category: SettingsCategoryId
  /** Extra search terms so the palette finds a section by what it contains. */
  keywords?: string[]
}

export type SettingsCategoryId =
  | 'general'
  | 'appearance'
  | 'agents'
  | 'system'
  | 'about'

export interface SettingsCategory {
  id: SettingsCategoryId
  label: string
}

/** Render order of settings categories, mirroring the sidebar's grouping. */
export const SETTINGS_CATEGORIES: SettingsCategory[] = [
  { id: 'general', label: 'General' },
  { id: 'appearance', label: 'Appearance' },
  { id: 'agents', label: 'Agents' },
  { id: 'system', label: 'System' },
  { id: 'about', label: 'About' },
]

// Order matters: this is the top-to-bottom order in the settings rail. The
// first entry is also where the user lands by default.
export const SETTINGS_SECTIONS: SettingsSectionMeta[] = [
  {
    id: 'paths',
    label: 'Config Paths',
    icon: 'folder',
    category: 'general',
    keywords: ['directory', 'location', 'detect'],
  },
  {
    id: 'preferences',
    label: 'Preferences',
    icon: 'sliders',
    category: 'general',
    keywords: ['billing', 'cost', 'currency', 'quota', 'budget'],
  },
  {
    id: 'appearance',
    label: 'Appearance',
    icon: 'palette',
    category: 'appearance',
    keywords: ['theme', 'dark', 'light', 'color'],
  },
  {
    id: 'theme-builder',
    label: 'Theme Builder',
    icon: 'paintbrush',
    category: 'appearance',
    keywords: ['custom', 'theme', 'color'],
  },
  {
    id: 'agent-icons',
    label: 'Agent Icons',
    icon: 'bot',
    category: 'appearance',
    keywords: ['icon', 'logo'],
  },
  {
    id: 'agents',
    label: 'Agents',
    icon: 'bot',
    category: 'agents',
    keywords: ['enable', 'disable', 'visible'],
  },
  {
    id: 'shortcuts',
    label: 'Shortcuts',
    icon: 'keyboard',
    category: 'system',
    keywords: ['keybinding', 'hotkey', 'key'],
  },
  {
    id: 'backups',
    label: 'Backups',
    icon: 'archive',
    category: 'system',
    keywords: ['backup', 'restore', 'auto', 'daily'],
  },
  {
    id: 'about',
    label: 'About',
    icon: 'info',
    category: 'about',
    keywords: ['version', 'update'],
  },
]

export const DEFAULT_SETTINGS_SECTION = SETTINGS_SECTIONS[0].id
