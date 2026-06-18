import type { AgentAdapter, SidebarSection } from '@/shared/types/agent'
import { rooDefinition } from '@/shared/agents/defs'
import { validateMarkdownInstructions } from '../lib/validators'
import { createAdapter } from './base.adapter'

/** Roo Code — edits global rules, MCP servers, and raw settings under `~/.roo/`. */
export const rooAdapter: AgentAdapter = createAdapter(rooDefinition, {
  icon: 'img:roo',
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
