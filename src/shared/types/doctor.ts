/**
 * Config Doctor — a cross-agent health scan. Pure types shared by the renderer,
 * the IPC contract and the `core/doctor` engine. The doctor runs static checks
 * (no network, no process spawning) over each enabled agent's on-disk config and
 * returns a flat list of {@link DoctorFinding}s, some carrying a safe,
 * structured {@link DoctorFix} the main process can apply on request.
 */

import type { AgentId } from './agent'

export type DoctorSeverity = 'error' | 'warning' | 'info'

export type DoctorCategory =
  | 'mcp'
  | 'hooks'
  | 'permissions'
  | 'settings'
  | 'general'

/**
 * A self-contained, reversible auto-fix. Every field needed to apply it is
 * captured at scan time so applying it never depends on stale renderer state.
 * Writes still go through the snapshotting atomic-write path, so any fix can be
 * undone from the Activity log.
 */
export type DoctorFix =
  | {
      kind: 'remove-mcp-server'
      agentId: AgentId
      basePath: string
      serverId: string
      serverName: string
    }
  | {
      kind: 'remove-empty-hooks'
      agentId: AgentId
      basePath: string
    }

export interface DoctorFinding {
  /** Stable id for list rendering + fix de-duplication. */
  id: string
  agentId: AgentId
  agentName: string
  severity: DoctorSeverity
  category: DoctorCategory
  title: string
  detail: string
  /** Renderer route where the user can fix it by hand. */
  route?: string
  /** A safe one-click fix, when one exists. */
  fix?: DoctorFix
}

/** What the renderer hands the doctor for one agent to scan. */
export interface DoctorAgentInput {
  agentId: AgentId
  displayName: string
  /** Resolved global config base; empty when none was detected. */
  basePath: string
  caps: {
    mcp: boolean
    hooks: boolean
    permissions: boolean
    rawSettings: boolean
  }
}

export interface DoctorReport {
  findings: DoctorFinding[]
  /** ISO timestamp the scan completed. */
  checkedAt: string
  agentCount: number
  counts: { error: number; warning: number; info: number }
}

export interface DoctorFixResult {
  success: boolean
  message: string
}
