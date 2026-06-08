import type { AgentAdapter, SidebarSection } from '@/shared/types/agent'
import { cursorDefinition } from '@/shared/agents/defs'
import { validateMarkdownInstructions } from '../lib/validators'
import { createAdapter } from './base.adapter'

/**
 * Cursor — instructions (AGENTS.md + .cursorrules), subagents, slash commands,
 * skills, always-on rules (`.mdc`), MCP servers and flat lifecycle hooks, all
 * under `<base>/.cursor`.
 */
export const cursorAdapter: AgentAdapter = createAdapter(cursorDefinition, {
  icon: 'img:cursor',
  validate: validateMarkdownInstructions,
  getSidebarSections: (): SidebarSection[] => [
    {
      id: 'agents',
      label: 'Subagents',
      icon: 'bot',
      route: '/agents',
      description: 'Subagent definitions',
    },
    {
      id: 'commands',
      label: 'Commands',
      icon: 'square-slash',
      route: '/commands',
      description: 'Custom slash commands',
    },
    {
      id: 'skills',
      label: 'Skills',
      icon: 'graduation-cap',
      route: '/skills',
      description: 'Reusable skills',
    },
    {
      id: 'rules',
      label: 'Rules',
      icon: 'book-open',
      route: '/rules',
      description: 'Always-on behaviour rules (.mdc)',
    },
    {
      id: 'mcp',
      label: 'MCP Servers',
      icon: 'plug',
      route: '/mcp',
      description: 'Model Context Protocol servers',
    },
    {
      id: 'hooks',
      label: 'Hooks',
      icon: 'webhook',
      route: '/hooks',
      description: 'Lifecycle hooks',
    },
  ],
})
