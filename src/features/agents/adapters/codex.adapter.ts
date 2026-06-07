import type { AgentAdapter, SidebarSection } from '@/shared/types/agent'
import { codexDefinition } from '@/shared/agents/defs'
import { validateMarkdownInstructions } from '../lib/validators'
import { createAdapter } from './base.adapter'

/** OpenAI Codex: AGENTS.md instruction files + chat history / live chat. */
export const codexAdapter: AgentAdapter = createAdapter(codexDefinition, {
  icon: 'img:codex',
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
      id: 'commands',
      label: 'Prompts',
      icon: 'square-slash',
      route: '/commands',
      description: 'Custom prompts (slash commands)',
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
      id: 'approvals',
      label: 'Approvals',
      icon: 'shield',
      route: '/permissions',
    },
  ],
})
