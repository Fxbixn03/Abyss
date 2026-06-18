import type { AgentAdapter, SidebarSection } from '@/shared/types/agent'
import { warpDefinition } from '@/shared/agents/defs'
import { validateMarkdownInstructions } from '../lib/validators'
import { createAdapter } from './base.adapter'

/** Warp terminal AI — edits the global agent instructions under `~/.warp/agents/`. */
export const warpAdapter: AgentAdapter = createAdapter(warpDefinition, {
  icon: 'terminal',
  validate: validateMarkdownInstructions,
  getSidebarSections: (): SidebarSection[] => [
    {
      id: 'agents',
      label: 'Agent Personas',
      icon: 'bot',
      route: '/agents',
      description: 'Named Warp agent instruction files',
    },
    {
      id: 'mcp',
      label: 'MCP Servers',
      icon: 'plug',
      route: '/mcp',
      description: 'Model Context Protocol servers',
    },
  ],
})
