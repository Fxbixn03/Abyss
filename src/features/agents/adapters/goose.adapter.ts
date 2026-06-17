import type { AgentAdapter, SidebarSection } from '@/shared/types/agent'
import { gooseDefinition } from '@/shared/agents/defs'
import { createAdapter } from './base.adapter'

/**
 * Goose (Block) — edits the global `config.yaml` under `~/.config/goose`.
 * MCP-compatible extensions are surfaced via the MCP Servers sidebar section.
 */
export const gooseAdapter: AgentAdapter = createAdapter(gooseDefinition, {
  icon: 'bird',
  getSidebarSections: (): SidebarSection[] => [
    {
      id: 'mcp',
      label: 'MCP Servers',
      icon: 'plug',
      route: '/mcp',
      description: 'Model Context Protocol extensions',
    },
    {
      id: 'settings-file',
      label: 'Settings (raw)',
      icon: 'braces',
      route: '/settings-file',
      description: 'Raw config.yaml',
    },
  ],
})
