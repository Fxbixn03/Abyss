import type { AgentAdapter, SidebarSection } from '@/shared/types/agent'
import { cursorDefinition } from '@/shared/agents/defs'
import { validateMarkdownInstructions } from '../lib/validators'
import { createAdapter } from './base.adapter'

/** Cursor: `.cursorrules` instructions + MCP servers in `.cursor/mcp.json`. */
export const cursorAdapter: AgentAdapter = createAdapter(cursorDefinition, {
  icon: 'img:cursor',
  validate: validateMarkdownInstructions,
  getSidebarSections: (): SidebarSection[] => [
    { id: 'mcp', label: 'MCP Servers', icon: 'plug', route: '/mcp' },
  ],
})
