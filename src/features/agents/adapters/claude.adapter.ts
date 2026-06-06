import type { AgentAdapter, SidebarSection } from '@/shared/types/agent'
import { claudeDefinition } from '@/shared/agents/defs'
import { validateMarkdownInstructions } from '../lib/validators'
import { createAdapter } from './base.adapter'

/** Claude Code: the most fully-featured agent (instructions, MCP, perms, model). */
export const claudeAdapter: AgentAdapter = createAdapter(claudeDefinition, {
  icon: 'img:claude',
  validate: validateMarkdownInstructions,
  getSidebarSections: (): SidebarSection[] => [
    { id: 'chats', label: 'Chats', icon: 'messages-square', route: '/chats' },
    { id: 'agents', label: 'Agents', icon: 'bot', route: '/agents' },
    {
      id: 'commands',
      label: 'Commands',
      icon: 'square-slash',
      route: '/commands',
    },
    { id: 'skills', label: 'Skills', icon: 'graduation-cap', route: '/skills' },
    { id: 'mcp', label: 'MCP Servers', icon: 'plug', route: '/mcp' },
    { id: 'hooks', label: 'Hooks', icon: 'webhook', route: '/hooks' },
    {
      id: 'permissions',
      label: 'Permissions',
      icon: 'shield',
      route: '/permissions',
    },
    {
      id: 'model-env',
      label: 'Model & Env',
      icon: 'sliders',
      route: '/model-env',
    },
    {
      id: 'settings-file',
      label: 'Settings (raw)',
      icon: 'braces',
      route: '/settings-file',
    },
  ],
})
