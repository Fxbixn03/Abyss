import type { AgentAdapter, SidebarSection } from '@/shared/types/agent'
import { plandexDefinition } from '@/shared/agents/defs'
import { validateMarkdownInstructions } from '../lib/validators'
import { createAdapter } from './base.adapter'

/** Plandex — edits global instructions at `~/.plandex/instructions.md`. */
export const plandexAdapter: AgentAdapter = createAdapter(plandexDefinition, {
  icon: 'layers',
  validate: validateMarkdownInstructions,
  getSidebarSections: (): SidebarSection[] => [
    {
      id: 'mcp',
      label: 'MCP Servers',
      icon: 'plug',
      route: '/mcp',
    },
  ],
})
