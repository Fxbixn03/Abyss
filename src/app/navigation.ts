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
  '/relations': 'overview',
  '/config': 'development',
  '/agents': 'development',
  '/commands': 'development',
  '/skills': 'development',
  '/rules': 'development',
  '/templates': 'development',
  '/sandbox': 'development',
  '/chats': 'runtime',
  '/sessions': 'runtime',
  '/insights': 'runtime',
  '/context': 'runtime',
  '/usage': 'runtime',
  '/history': 'runtime',
  '/activity': 'runtime',
  '/validation': 'system',
  '/doctor': 'system',
  '/mcp': 'system',
  '/hooks': 'system',
  '/permissions': 'system',
  '/model-env': 'system',
  '/statusline': 'system',
  '/spinner': 'system',
  '/plugins': 'system',
  '/settings-file': 'system',
  '/bundles': 'tools',
  '/compare': 'tools',
  '/discover': 'tools',
  '/marketplace': 'tools',
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
    id: 'relations',
    label: 'Relations',
    icon: 'waypoints',
    route: '/relations',
    description: 'Visualize how components connect',
  },
  {
    id: 'instructions',
    label: 'Instructions',
    icon: 'file-text',
    route: '/config',
    description: 'Edit instruction files',
  },
  {
    id: 'context',
    label: 'Context',
    icon: 'list-tree',
    route: '/context',
    description: 'Compiled prompt & conflicts',
  },
  {
    id: 'usage',
    label: 'Analytics',
    icon: 'bar-chart-3',
    route: '/usage',
    description: 'Token & cost usage over time',
  },
  {
    id: 'sessions',
    label: 'Sessions',
    icon: 'files',
    route: '/sessions',
    description: 'Browse, compare & inspect sessions',
  },
  {
    id: 'insights',
    label: 'Insights',
    icon: 'gauge',
    route: '/insights',
    description: 'Session friction & quality signals',
  },
  {
    id: 'validation',
    label: 'Validation',
    icon: 'clipboard-check',
    route: '/validation',
    description: 'Lint your agent config',
  },
  {
    id: 'doctor',
    label: 'Doctor',
    icon: 'stethoscope',
    route: '/doctor',
    description: 'Health-check & auto-fix',
  },
  {
    id: 'history',
    label: 'History',
    icon: 'history',
    route: '/history',
    description: 'Config snapshots & restore',
  },
  {
    id: 'activity',
    label: 'Activity',
    icon: 'scroll-text',
    route: '/activity',
    description: 'What Abyss changed, with undo',
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
    id: 'discover',
    label: 'Discover',
    icon: 'scan-search',
    route: '/discover',
    description: 'Find agents & MCP on this machine',
  },
  {
    id: 'marketplace',
    label: 'Marketplace',
    icon: 'store',
    route: '/marketplace',
    description: 'Browse & install MCP servers',
  },
  {
    id: 'templates',
    label: 'Templates',
    icon: 'library',
    route: '/templates',
    description: 'Reusable prompt templates',
  },
  {
    id: 'sandbox',
    label: 'Sandbox',
    icon: 'flask-conical',
    route: '/sandbox',
    description: 'Try commands, hooks & prompts',
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
