import type { AgentAdapter, SidebarSection } from '@/shared/types/agent'
import { windsurfDefinition } from '@/shared/agents/defs'
import { validateMarkdownInstructions } from '../lib/validators'
import { createAdapter } from './base.adapter'

/**
 * Windsurf (Codeium) — global Cascade rules, MCP servers, and user settings
 * under `~/.codeium/windsurf`.
 */
export const windsurfAdapter: AgentAdapter = createAdapter(windsurfDefinition, {
  icon: 'img:windsurf',
  validate: validateMarkdownInstructions,
  getSidebarSections: (): SidebarSection[] => [
    {
      id: 'rules',
      label: 'Rules',
      icon: 'book-open',
      route: '/rules',
      description: 'Always-on Cascade rules (.md)',
    },
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
