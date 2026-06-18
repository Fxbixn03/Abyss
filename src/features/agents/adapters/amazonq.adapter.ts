import type { AgentAdapter, SidebarSection } from '@/shared/types/agent'
import { amazonqDefinition } from '@/shared/agents/defs'
import { validateMarkdownInstructions } from '../lib/validators'
import { createAdapter } from './base.adapter'

/** Amazon Q Developer CLI — edits the global system prompt under `~/.aws/amazonq/`. */
export const amazonqAdapter: AgentAdapter = createAdapter(amazonqDefinition, {
  icon: 'cloud',
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
