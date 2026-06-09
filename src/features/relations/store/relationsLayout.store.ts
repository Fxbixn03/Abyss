import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { XY } from '../lib/layout'

type Positions = Record<string, XY>

interface RelationsLayoutState {
  /** `${agentId}:${scopeKey}` → nodeId → position. */
  positions: Record<string, Positions>
  setPosition: (key: string, nodeId: string, xy: XY) => void
  /**
   * Drop positions for node ids not in `keepIds`. The caller MUST only invoke
   * this after a successful read where the node is definitely gone — never on a
   * read error (a temporarily unreadable file must keep its position).
   */
  prune: (key: string, keepIds: string[]) => void
  /** Forget all positions for a key (the "Re-Layout" button). */
  resetLayout: (key: string) => void
  /** Quota GC: drop persisted keys whose agent is no longer active. */
  gcAgents: (activeAgentIds: string[]) => void
}

/** Build the persistence key for an agent + scope. */
export function layoutKey(
  agentId: string,
  scope: string,
  projectDir?: string | null,
): string {
  return scope === 'project'
    ? `${agentId}:project:${projectDir ?? ''}`
    : `${agentId}:global`
}

export const useRelationsLayout = create<RelationsLayoutState>()(
  persist(
    (set) => ({
      positions: {},

      setPosition: (key, nodeId, xy) =>
        set((s) => ({
          positions: {
            ...s.positions,
            [key]: { ...s.positions[key], [nodeId]: xy },
          },
        })),

      prune: (key, keepIds) =>
        set((s) => {
          const current = s.positions[key]
          if (!current) return s
          const keep = new Set(keepIds)
          const next: Positions = {}
          for (const [id, xy] of Object.entries(current)) {
            if (keep.has(id)) next[id] = xy
          }
          return { positions: { ...s.positions, [key]: next } }
        }),

      resetLayout: (key) =>
        set((s) => {
          const next = { ...s.positions }
          delete next[key]
          return { positions: next }
        }),

      gcAgents: (activeAgentIds) =>
        set((s) => {
          const active = new Set(activeAgentIds)
          const next: Record<string, Positions> = {}
          for (const [key, value] of Object.entries(s.positions)) {
            const agentId = key.slice(0, key.indexOf(':'))
            if (active.has(agentId)) next[key] = value
          }
          return { positions: next }
        }),
    }),
    { name: 'abyss-relations-layout' },
  ),
)
