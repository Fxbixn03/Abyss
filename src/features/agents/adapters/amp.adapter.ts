import type { AgentAdapter, SidebarSection } from '@/shared/types/agent'
import { ampDefinition } from '@/shared/agents/defs'
import { validateMarkdownInstructions } from '../lib/validators'
import { createAdapter } from './base.adapter'

/** Amp (Sourcegraph) — edits global instructions at `~/.amp/AGENTS.md`. */
export const ampAdapter: AgentAdapter = createAdapter(ampDefinition, {
  icon: 'img:amp',
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
      description: 'Raw settings.json',
    },
  ],
})
