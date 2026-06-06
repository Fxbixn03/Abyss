/**
 * Multi-agent sync & compare model. A "surface" is a copyable slice of config
 * (instructions, MCP servers, permissions). Pure types, shared by core + UI.
 */

import type { McpServerEntry, PermissionRules } from './config'

export type SyncSurface = 'instructions' | 'mcp' | 'permissions'

export const SYNC_SURFACE_LABELS: Record<SyncSurface, string> = {
  instructions: 'Instructions',
  mcp: 'MCP Servers',
  permissions: 'Permissions',
}

/** The concrete value of a surface, discriminated by `kind`. */
export type SurfaceValue =
  | { kind: 'instructions'; content: string }
  | { kind: 'mcp'; servers: McpServerEntry[] }
  | { kind: 'permissions'; rules: PermissionRules }

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
