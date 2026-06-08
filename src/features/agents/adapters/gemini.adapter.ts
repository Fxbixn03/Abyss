import type { AgentAdapter, SidebarSection } from '@/shared/types/agent'
import { geminiDefinition } from '@/shared/agents/defs'
import { validateMarkdownInstructions } from '../lib/validators'
import { createAdapter } from './base.adapter'

/**
 * Gemini CLI — subagents, grouped TOML slash commands, skills, MCP, hooks and
 * raw settings, all under `~/.gemini` (or `<project>/.gemini`).
 */
export const geminiAdapter: AgentAdapter = createAdapter(geminiDefinition, {
  icon: 'img:gemini',
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
      description: 'Grouped slash commands (TOML)',
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
      id: 'settings-file',
      label: 'Settings (raw)',
      icon: 'braces',
      route: '/settings-file',
      description: 'Raw settings.json',
    },
  ],
})
