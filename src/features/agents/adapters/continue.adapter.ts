import type { AgentAdapter, SidebarSection } from '@/shared/types/agent'
import { continueDefinition } from '@/shared/agents/defs'
import { validateYamlContent } from '@/features/agents/lib/validators'
import { createAdapter } from './base.adapter'

/**
 * Continue — edits the global `config.yaml` under `~/.continue`.
 * MCP servers declared under `mcpServers` in `config.yaml` are surfaced via the
 * shared MCP Servers sidebar section. The raw `config.yaml` is also exposed
 * via the settings-file sidebar section for direct editing.
 */
export const continueAdapter: AgentAdapter = createAdapter(continueDefinition, {
  icon: 'infinity',
  validate: validateYamlContent,
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
      label: 'Settings (raw)',
      icon: 'braces',
      route: '/settings-file',
      description: 'Raw config.yaml',
    },
  ],
})
