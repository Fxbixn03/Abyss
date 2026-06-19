import type { AgentAdapter, SidebarSection } from '@/shared/types/agent'
import { openhandsDefinition } from '@/shared/agents/defs'
import { validateTomlContent } from '@/features/agents/lib/validators'
import { createAdapter } from './base.adapter'

/** OpenHands (all-hands.dev) — edits global config at `~/.openhands/config.toml`. */
export const openhandsAdapter: AgentAdapter = createAdapter(openhandsDefinition, {
  icon: 'brain',
  validate: validateTomlContent,
  getSidebarSections: (): SidebarSection[] => [
    {
      id: 'settings-file',
      label: 'Settings (raw)',
      icon: 'braces',
      route: '/settings-file',
      description: 'Raw config.toml',
    },
  ],
})
