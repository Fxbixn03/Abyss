import type { AgentAdapter, SidebarSection } from '@/shared/types/agent'
import { aiderDefinition } from '@/shared/agents/defs'
import { createAdapter } from './base.adapter'

/**
 * Aider — edits the YAML config at `~/.aider.conf.yml`.
 * MCP servers declared under `mcp_servers` in that file are surfaced via the
 * shared MCP Servers sidebar section (Aider 0.77+).
 */
export const aiderAdapter: AgentAdapter = createAdapter(aiderDefinition, {
  icon: 'terminal',
  getSidebarSections: (): SidebarSection[] => [
    {
      id: 'mcp',
      label: 'MCP Servers',
      icon: 'plug',
      route: '/mcp',
      description: 'Model Context Protocol servers',
    },
    {
      id: 'settings-file',
      label: 'Model Settings',
      icon: 'braces',
      route: '/settings-file',
      description: 'Per-model overrides (.aider.model.settings.yml)',
    },
  ],
})
