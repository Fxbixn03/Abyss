/**
 * Portable config bundle model — shared between core (export/apply IO), the
 * Electron main process, the renderer GUI and the CLI. Pure types.
 */

import type { McpServerEntry, PermissionRules } from './config'

export interface AgentBundle {
  agentId: string
  basePath: string
  /** specId -> file content */
  files: Record<string, string>
  mcpServers?: McpServerEntry[]
  permissions?: PermissionRules
}

export interface ExportBundle {
  $schema: 'abyss-bundle/v1'
  version: 1
  exportedAt: string
  agents: AgentBundle[]
}

export type ApplyKind = 'file' | 'mcp' | 'permissions'

export interface ApplyChange {
  agentId: string
  kind: ApplyKind
  target: string
  changed: boolean
}
