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
  /** Set to true when this agent was skipped during export due to a read/parse error. */
  skipped?: true
  /** Human-readable reason this agent was skipped (only present when skipped is true). */
  skipReason?: string
}

export interface ExportBundle {
  $schema: 'abyss-bundle/v1'
  version: 1
  exportedAt: string
  agents: AgentBundle[]
  /** Agent IDs that were skipped during export due to read/parse errors. */
  skippedAgents?: string[]
}

export type ApplyKind = 'file' | 'mcp' | 'permissions'

export interface ApplyChange {
  agentId: string
  kind: ApplyKind
  target: string
  changed: boolean
}
