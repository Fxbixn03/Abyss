import type { AgentAdapter, SidebarSection } from '@/shared/types/agent'
import { windsurfDefinition } from '@/shared/agents/defs'
import { validateMarkdownInstructions } from '../lib/validators'
import { createAdapter } from './base.adapter'

/**
 * Windsurf (Codeium) — global Cascade rules and MCP servers under
 * `~/.codeium/windsurf`.
 */
export const windsurfAdapter: AgentAdapter = createAdapter(windsurfDefinition, {
  icon: 'wind',
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
