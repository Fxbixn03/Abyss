/**
 * Structured config payloads shared across renderer, main process and CLI.
 */

import type { AgentId } from './agent'

/** A single MCP server entry (Claude Code). */
export interface McpServerEntry {
  /** Stable local id for list rendering. */
  id: string
  /** Key under `mcpServers` in the on-disk config. */
  name: string
  type: 'stdio' | 'http' | 'sse'
  /** stdio transport. */
  command?: string
  args?: string[]
  /** http / sse transport. */
  url?: string
  env?: Record<string, string>
  enabled: boolean
}

/** Result of a "test connection" health check against an MCP server. */
export interface McpHealthResult {
  ok: boolean
  /** Tool names reported by the server (stdio transport). */
  tools: string[]
  serverName?: string
  serverVersion?: string
  error?: string
  durationMs: number
}

/** Allow / deny / ask permission rules. */
export interface PermissionRules {
  allow: string[]
  deny: string[]
  ask: string[]
}

/** Model + environment configuration for an agent. */
export interface ModelEnvConfig {
  model?: string
  env: Record<string, string>
}

/** Persisted application settings (userData). */
export interface AppSettings {
  /** Chosen base directory per agent (global scope, v1). */
  agentPaths: Record<AgentId, string>
  /** Agent selected on launch; falls back to the persisted active agent. */
  startupAgentId?: AgentId
  defaultProjectDir?: string
  /** Show a diff confirmation before writing real files. On by default. */
  confirmDiffBeforeSave: boolean
  /** Launch Abyss on OS login (persisted; applied on next launch). */
  launchOnStartup: boolean
  /** Whether the first-run setup has been completed. */
  onboarded: boolean
}

export const DEFAULT_APP_SETTINGS: AppSettings = {
  agentPaths: {},
  confirmDiffBeforeSave: true,
  launchOnStartup: false,
  onboarded: false,
}

/** App / build metadata surfaced in the About screen. */
export interface AppInfo {
  name: string
  version: string
  electron: string
  chrome: string
  node: string
  platform: string
}
