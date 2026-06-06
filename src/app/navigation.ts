export interface NavItem {
  id: string
  label: string
  icon: string
  route: string
}

/** Always-present navigation (agent-independent). */
export const PRIMARY_NAV: NavItem[] = [
  { id: 'dashboard', label: 'Dashboard', icon: 'layout-dashboard', route: '/' },
  {
    id: 'instructions',
    label: 'Instructions',
    icon: 'file-text',
    route: '/config',
  },
  { id: 'history', label: 'History', icon: 'history', route: '/history' },
  { id: 'bundles', label: 'Bundles', icon: 'package', route: '/bundles' },
  { id: 'profiles', label: 'Profiles', icon: 'layers', route: '/profiles' },
  { id: 'compare', label: 'Compare', icon: 'git-compare', route: '/compare' },
]

/** Pinned to the bottom of the sidebar. */
export const SETTINGS_NAV: NavItem = {
  id: 'settings',
  label: 'Settings',
  icon: 'settings',
  route: '/settings',
}
