import type { AgentAdapter, SidebarSection } from '@/shared/types/agent'
import { voidDefinition } from '@/shared/agents/defs'
import { validateMarkdownInstructions } from '../lib/validators'
import { createAdapter } from './base.adapter'

/** Void Editor — edits global instructions, MCP servers, and raw settings under `~/.void/`. */
export const voidAdapter: AgentAdapter = createAdapter(voidDefinition, {
  icon: 'box',
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
