import type { AgentAdapter, SidebarSection } from '@/shared/types/agent'
import { clineDefinition } from '@/shared/agents/defs'
import { validateMarkdownInstructions } from '../lib/validators'
import { createAdapter } from './base.adapter'

/** Cline — edits a global rules file under `~/Documents/Cline/Rules`. */
export const clineAdapter: AgentAdapter = createAdapter(clineDefinition, {
  icon: 'bot',
  validate: validateMarkdownInstructions,
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
