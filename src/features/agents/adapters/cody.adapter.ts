import type { AgentAdapter, SidebarSection } from '@/shared/types/agent'
import { codyDefinition } from '@/shared/agents/defs'
import { validateJsonContent } from '@/features/agents/lib/validators'
import { createAdapter } from './base.adapter'

/** Sourcegraph Cody CLI — edits config.json with customInstructions and mcpServers fields. */
export const codyAdapter: AgentAdapter = createAdapter(codyDefinition, {
  icon: 'search-code',
  validate: validateJsonContent,
  getSidebarSections: (): SidebarSection[] => [
    {
      id: 'mcp',
      label: 'MCP Servers',
      icon: 'plug',
      route: '/mcp',
    },
  ],
})
