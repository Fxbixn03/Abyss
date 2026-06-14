/**
 * Multi-agent sync & compare model. A "surface" is a copyable slice of config
 * (instructions, MCP servers, permissions, hooks). Pure types, shared by
 * core + UI.
 */

import type { McpServerEntry, PermissionRules } from './config'
import type { HookEntry } from './hooks'

export type SyncSurface = 'instructions' | 'mcp' | 'permissions' | 'hooks'

export const SYNC_SURFACE_LABELS: Record<SyncSurface, string> = {
  instructions: 'Instructions',
  mcp: 'MCP Servers',
  permissions: 'Permissions',
  hooks: 'Hooks',
}

/** The concrete value of a surface, discriminated by `kind`. */
export type SurfaceValue =
  | { kind: 'instructions'; content: string }
  | { kind: 'mcp'; servers: McpServerEntry[] }
  | { kind: 'permissions'; rules: PermissionRules }
  | { kind: 'hooks'; hooks: HookEntry[] }

/** One agent's view of a surface (or that it doesn't support it). */
export interface AgentSurface {
  agentId: string
  supported: boolean
  value: SurfaceValue | null
  /** Backing file path, when meaningful. */
  path?: string
}

export interface SurfaceComparison {
  surface: SyncSurface
  a: AgentSurface
  b: AgentSurface
  /** True when both support the surface and their values match. */
  equal: boolean
}

export interface CopyResult {
  changed: boolean
  target: string
}

export interface SyncAllResult {
  agentId: string
  changed: boolean
  target: string
}
