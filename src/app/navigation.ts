export interface NavItem {
  id: string
  label: string
  icon: string
  route: string
  /** Short tooltip shown in the sidebar. */
  description?: string
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
