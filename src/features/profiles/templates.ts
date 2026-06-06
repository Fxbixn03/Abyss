/**
 * Starter "environment" templates for profiles. Selecting one pre-fills a
 * profile's name, description and icon; the profile still captures the current
 * on-disk config (model, prompt, MCP servers, permissions) as its bundle.
 */
export interface EnvironmentTemplate {
  id: string
  name: string
  description: string
  icon: string
}

export const ENVIRONMENT_TEMPLATES: EnvironmentTemplate[] = [
  {
    id: 'work',
    name: 'Work',
    description: 'Day-to-day work setup.',
    icon: 'folder',
  },
  {
    id: 'private',
    name: 'Private',
    description: 'Personal projects and experiments.',
    icon: 'user',
  },
  {
    id: 'unsafe',
    name: 'Unsafe Experimental',
    description: 'Loose permissions for throwaway exploration.',
    icon: 'zap',
  },
  {
    id: 'offline',
    name: 'Offline',
    description: 'No network tools or MCP servers.',
    icon: 'globe',
  },
  {
    id: 'ci',
    name: 'CI Mode',
    description: 'Non-interactive, deterministic config for pipelines.',
    icon: 'cpu',
  },
]

export const DEFAULT_PROFILE_ICON = 'layers'
