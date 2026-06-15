import type { AgentAdapter, SidebarSection } from '@/shared/types/agent'
import { continueDefinition } from '@/shared/agents/defs'
import { createAdapter } from './base.adapter'

/**
 * Continue — edits the global `config.yaml` under `~/.continue`.
 * MCP servers declared under `mcpServers` in `config.yaml` are surfaced via the
 * shared MCP Servers sidebar section.
 */
export const continueAdapter: AgentAdapter = createAdapter(continueDefinition, {
  icon: 'infinity',
  getSidebarSections: (): SidebarSection[] => [
    {
      id: 'mcp',
      label: 'MCP Servers',
      icon: 'plug',
      route: '/mcp',
      description: 'Model Context Protocol servers',
    },
  ],
})
