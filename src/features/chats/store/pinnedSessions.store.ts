import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface PinnedSessionsState {
  /** IDs of sessions the user has pinned. */
  pinnedSessionIds: Set<string>
  /** Toggle a session's pinned state. Returns the new pinned state. */
  togglePin: (id: string) => void
  /** Returns true if the given session is pinned. */
  isPinned: (id: string) => boolean
}

/**
 * Persisted store that tracks which chat sessions are pinned.
 * Pinned sessions float to the top of their group in SessionList.
 *
 * Persisted as an array under 'abyss:pinnedSessions' so JSON.stringify
 * can handle it (Set is not JSON-serializable by default).
 */
export const usePinnedSessionsStore = create<PinnedSessionsState>()(
  persist(
    (set, get) => ({
      pinnedSessionIds: new Set<string>(),
      togglePin: (id) =>
        set((s) => {
          const next = new Set(s.pinnedSessionIds)
          if (next.has(id)) {
            next.delete(id)
          } else {
            next.add(id)
          }
          return { pinnedSessionIds: next }
        }),
      isPinned: (id) => get().pinnedSessionIds.has(id),
    }),
    {
      name: 'abyss:pinnedSessions',
      // Serialize Set as an array for localStorage
      storage: {
        getItem: (name) => {
          const raw = localStorage.getItem(name)
          if (!raw) return null
          try {
            const parsed = JSON.parse(raw) as { state?: { pinnedSessionIds?: string[] } }
            const ids = parsed?.state?.pinnedSessionIds
            return {
              state: {
                pinnedSessionIds: new Set<string>(Array.isArray(ids) ? ids : []),
              },
              version: 0,
            }
          } catch {
            return null
          }
        },
        setItem: (name, value) => {
          const ids = [...value.state.pinnedSessionIds]
          localStorage.setItem(
            name,
            JSON.stringify({ state: { pinnedSessionIds: ids }, version: value.version }),
          )
        },
        removeItem: (name) => {
          localStorage.removeItem(name)
        },
      },
      partialize: (s) => ({ pinnedSessionIds: s.pinnedSessionIds }),
    },
  ),
)
