import type { AgentAdapter, SidebarSection } from '@/shared/types/agent'
import { claudeDefinition } from '@/shared/agents/defs'
import { validateMarkdownInstructions } from '../lib/validators'
import { createAdapter } from './base.adapter'

/** Claude Code: the most fully-featured agent (instructions, MCP, perms, model). */
export const claudeAdapter: AgentAdapter = createAdapter(claudeDefinition, {
  icon: 'img:claude',
  validate: validateMarkdownInstructions,
  getSidebarSections: (): SidebarSection[] => [
    {
      id: 'chats',
      label: 'Chats',
      icon: 'messages-square',
      route: '/chats',
      description: 'History & live chat',
    },
    {
      id: 'agents',
      label: 'Agents',
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
    {
      id: 'permissions',
      label: 'Permissions',
      icon: 'shield',
      route: '/permissions',
      description: 'Tool permission rules',
    },
    {
      id: 'model-env',
      label: 'Model & Env',
      icon: 'sliders',
      route: '/model-env',
      description: 'Model & environment',
    },
    {
      id: 'statusline',
      label: 'Status Line',
      icon: 'terminal',
      route: '/statusline',
      description: 'Build the bottom status bar',
    },
    {
      id: 'plugins',
      label: 'Plugins',
      icon: 'plug',
      route: '/plugins',
      description: 'Marketplaces & plugins',
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
