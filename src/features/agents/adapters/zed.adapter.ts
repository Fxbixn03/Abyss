import type { AgentAdapter, SidebarSection } from '@/shared/types/agent'
import { zedDefinition } from '@/shared/agents/defs'
import { createAdapter } from './base.adapter'

/**
 * Zed Editor — reads and writes the global `settings.json` under
 * `~/.config/zed` (Linux/macOS) or `%APPDATA%\Zed` (Windows).
 * MCP context servers are declared inline in that file under `context_servers`.
 */
export const zedAdapter: AgentAdapter = createAdapter(zedDefinition, {
  icon: 'code-2',
  getSidebarSections: (): SidebarSection[] => [
    {
      id: 'settings-file',
      label: 'Settings (raw)',
      icon: 'braces',
      route: '/settings-file',
      description: 'Raw settings.json',
    },
    {
      id: 'mcp',
      label: 'Context Servers',
      icon: 'plug',
      route: '/mcp',
      description: 'MCP context servers (context_servers key)',
    },
  ],
})
