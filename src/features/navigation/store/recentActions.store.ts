import { create } from 'zustand'
import { persist } from 'zustand/middleware'

/** Maximum number of entries kept in the persistent store. */
const MAX_STORED = 8

/** Maximum number of entries shown in the command palette Recent actions group. */
export const MAX_RECENT_ACTIONS_SHOWN = 4

/** A single recorded palette action. */
export interface RecentAction {
  /** Human-readable label shown in the palette (e.g. 'Switch to Claude Code'). */
  label: string
  /** Opaque identifier used for deduplication (e.g. 'agent:claude-code'). */
  value: string
  /** Lucide icon name to render beside the label. */
  icon: string
}

interface RecentActionsState {
  /** Ordered list of recently executed actions, most-recent first. */
  actions: RecentAction[]
  /** Record an action; deduplicates by `value` (most-recent-wins) and caps at MAX_STORED. */
  push: (action: RecentAction) => void
}

export const useRecentActionsStore = create<RecentActionsState>()(
  persist(
    (set) => ({
      actions: [],
      push: (action) =>
        set((s) => {
          // Remove any existing occurrence so the new one moves to the front.
          const filtered = s.actions.filter((a) => a.value !== action.value)
          return { actions: [action, ...filtered].slice(0, MAX_STORED) }
        }),
    }),
    {
      name: 'abyss:recent-actions',
      partialize: (s) => ({ actions: s.actions }),
    },
  ),
)
