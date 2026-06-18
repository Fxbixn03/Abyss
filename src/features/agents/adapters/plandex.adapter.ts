import type { AgentAdapter, SidebarSection } from '@/shared/types/agent'
import { plandexDefinition } from '@/shared/agents/defs'
import { validateMarkdownInstructions } from '../lib/validators'
import { createAdapter } from './base.adapter'

/** Plandex — edits global instructions at `~/.plandex/instructions.md` and raw settings at `~/.plandex/config.yaml`. */
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
    {
      id: 'settings-file',
      label: 'Settings (raw)',
      icon: 'braces',
      route: '/settings-file',
      description: 'Raw config.yaml',
    },
  ],
})
