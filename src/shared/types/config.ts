/**
 * Structured config payloads shared across renderer, main process and CLI.
 */

import type { AgentId } from './agent'
import type { CustomAgentSpec } from '@/shared/agents/custom-agent'

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

/** Claude Code's default permission posture (`permissions.defaultMode`). */
export type PermissionMode =
  | 'default'
  | 'acceptEdits'
  | 'plan'
  | 'bypassPermissions'

/** The three rule columns (excludes the wider `permissions` settings). */
export type PermissionColumn = 'allow' | 'deny' | 'ask'

/** Allow / deny / ask permission rules plus the wider `permissions` block. */
export interface PermissionRules {
  allow: string[]
  deny: string[]
  ask: string[]
  /** Default mode applied when no rule matches a call. */
  defaultMode?: PermissionMode
  /** Extra directories the agent may work in beyond the project root. */
  additionalDirectories?: string[]
}

/** Codex approval + sandbox settings (its equivalent of permissions). */
export type CodexApprovalPolicy =
  | 'untrusted'
  | 'on-failure'
  | 'on-request'
  | 'never'

export type CodexSandboxMode =
  | 'read-only'
  | 'workspace-write'
  | 'danger-full-access'

export interface CodexSettings {
  approvalPolicy: CodexApprovalPolicy
  sandboxMode: CodexSandboxMode
  /** Allow network access in workspace-write sandbox. */
  networkAccess: boolean
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
  /** Whether the guided product tour has been shown (or skipped) at least once. */
  tutorialDone: boolean
  /** Subscription (no per-token cost) vs API (pay-as-you-go). */
  billingMode: 'subscription' | 'api'
  /** Show estimated token costs (only meaningful for API billing). */
  showCosts: boolean
  /** Currency for the cost estimate. */
  currency: 'usd' | 'eur'
  /** Optional weekly token budget for the usage quota gauge (0/undefined = off). */
  weeklyTokenBudget?: number
  /** Optional rolling 5-hour session token budget for the quota gauge. */
  sessionTokenBudget?: number
  /** Daily auto-backup of all configs on first launch of the day. */
  autoBackup: boolean
  /** Backup directory; undefined → default under userData. */
  backupDir?: string
  /** How many most-recent backups to keep. */
  backupKeep: number
  /** User confirmed (once) that the sandbox runs real shell commands. */
  sandboxAcknowledged: boolean
  /** User-defined agents, persisted so main + renderer can register them. */
  customAgents: CustomAgentSpec[]
}

export const DEFAULT_APP_SETTINGS: AppSettings = {
  agentPaths: {},
  confirmDiffBeforeSave: true,
  launchOnStartup: false,
  onboarded: false,
  tutorialDone: false,
  billingMode: 'subscription',
  showCosts: false,
  currency: 'usd',
  autoBackup: true,
  backupKeep: 3,
  sandboxAcknowledged: false,
  customAgents: [],
}

/** Auto-update lifecycle, pushed to the renderer as it progresses. */
export type UpdateState =
  | 'idle'
  | 'checking'
  | 'available'
  | 'not-available'
  | 'downloading'
  | 'downloaded'
  | 'error'

export interface UpdateStatus {
  state: UpdateState
  version?: string
  /** 0–100 while downloading. */
  percent?: number
  message?: string
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
