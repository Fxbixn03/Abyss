import type { AgentAdapter, SidebarSection } from '@/shared/types/agent'
import { kiroDefinition } from '@/shared/agents/defs'
import { validateMarkdownInstructions } from '../lib/validators'
import { createAdapter } from './base.adapter'

/** Kiro (AWS) — edits the global steering file under `~/.kiro/steering/`. */
export const kiroAdapter: AgentAdapter = createAdapter(kiroDefinition, {
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
  ],
})
