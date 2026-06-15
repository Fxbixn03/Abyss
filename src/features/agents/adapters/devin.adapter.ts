import type { AgentAdapter, SidebarSection } from '@/shared/types/agent'
import { devinDefinition } from '@/shared/agents/defs'
import { createAdapter } from './base.adapter'

/** Devin CLI (Cognition AI) — edits global config at `~/.devin/config.toml`. */
export const devinAdapter: AgentAdapter = createAdapter(devinDefinition, {
  icon: 'bot',
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
