import type { AgentAdapter, SidebarSection } from '@/shared/types/agent'
import { copilotDefinition } from '@/shared/agents/defs'
import { validateMarkdownInstructions } from '../lib/validators'
import { createAdapter } from './base.adapter'

/**
 * GitHub Copilot CLI — personal global instructions (`copilot-instructions.md`),
 * MCP servers (`mcp-config.json`) and an editable `settings.json`, all under
 * `~/.copilot`.
 */
export const copilotAdapter: AgentAdapter = createAdapter(copilotDefinition, {
  icon: 'img:copilot',
  validate: validateMarkdownInstructions,
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
      description: 'Raw settings.json',
    },
  ],
})
