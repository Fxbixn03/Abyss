export interface NavItem {
  id: string
  label: string
  icon: string
  route: string
  /** Short tooltip shown in the sidebar. */
  description?: string
}

/** Sidebar grouping — every nav route is bucketed into one of these. */
export type NavGroupId =
  | 'overview'
  | 'development'
  | 'runtime'
  | 'system'
  | 'tools'

export interface NavGroup {
  id: NavGroupId
  label: string
}

/** Render order of sidebar groups. Empty groups are skipped. */
export const NAV_GROUPS: NavGroup[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'development', label: 'Development' },
  { id: 'runtime', label: 'Runtime' },
  { id: 'system', label: 'System' },
  { id: 'tools', label: 'Tools' },
]

/**
 * Maps a nav route to its sidebar group. Lives here (not on each adapter
 * section) so agent adapters stay tiny and grouping is configured in one place.
 * Unmapped routes fall back to 'tools'.
 */
const ROUTE_GROUP: Record<string, NavGroupId> = {
  '/': 'overview',
  '/config': 'development',
  '/agents': 'development',
  '/commands': 'development',
  '/skills': 'development',
  '/templates': 'development',
  '/chats': 'runtime',
  '/history': 'runtime',
  '/mcp': 'system',
  '/hooks': 'system',
  '/permissions': 'system',
  '/model-env': 'system',
  '/settings-file': 'system',
  '/bundles': 'tools',
  '/compare': 'tools',
  '/profiles': 'tools',
}

export function groupForRoute(route: string): NavGroupId {
  return ROUTE_GROUP[route] ?? 'tools'
}

/** Always-present navigation (agent-independent). */
export const PRIMARY_NAV: NavItem[] = [
  {
    id: 'dashboard',
    label: 'Dashboard',
    icon: 'layout-dashboard',
    route: '/',
    description: 'Overview, agents and usage',
  },
  {
    id: 'instructions',
    label: 'Instructions',
    icon: 'file-text',
    route: '/config',
    description: 'Edit instruction files',
  },
  {
    id: 'history',
    label: 'History',
    icon: 'history',
    route: '/history',
    description: 'Config snapshots & restore',
  },
  {
    id: 'bundles',
    label: 'Bundles',
    icon: 'package',
    route: '/bundles',
    description: 'Export / apply your config',
  },
  {
    id: 'profiles',
    label: 'Profiles',
    icon: 'layers',
    route: '/profiles',
    description: 'Named config sets',
  },
  {
    id: 'compare',
    label: 'Compare',
    icon: 'git-compare',
    route: '/compare',
    description: 'Diff & sync agents',
  },
  {
    id: 'templates',
    label: 'Templates',
    icon: 'library',
    route: '/templates',
    description: 'Reusable prompt templates',
  },
]

/** Pinned to the bottom of the sidebar. */
export const SETTINGS_NAV: NavItem = {
  id: 'settings',
  label: 'Settings',
  icon: 'settings',
  route: '/settings',
  description: 'Paths, appearance, preferences',
}
