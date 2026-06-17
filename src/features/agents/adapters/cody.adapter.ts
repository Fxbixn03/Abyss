import type { AgentAdapter, SidebarSection } from '@/shared/types/agent'
import { codyDefinition } from '@/shared/agents/defs'
import { createAdapter } from './base.adapter'

/** Sourcegraph Cody CLI — edits config.json with customInstructions and mcpServers fields. */
export const codyAdapter: AgentAdapter = createAdapter(codyDefinition, {
  icon: 'search-code',
  getSidebarSections: (): SidebarSection[] => [
    {
      id: 'mcp',
      label: 'MCP Servers',
      icon: 'plug',
      route: '/mcp',
    },
  ],
})
