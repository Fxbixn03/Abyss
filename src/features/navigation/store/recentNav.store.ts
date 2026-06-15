import { create } from 'zustand'
import { persist } from 'zustand/middleware'

/** Maximum number of entries kept in the persistent store. */
const MAX_STORED = 8

/** Maximum number of entries shown in the command palette Recent group. */
export const MAX_RECENT_SHOWN = 5

interface RecentNavState {
  /** Ordered list of recently visited routes, most-recent first. */
  routes: string[]
  /** Record a navigation; deduplicates (most-recent-wins) and caps at MAX_STORED. */
  push: (route: string) => void
}

export const useRecentNavStore = create<RecentNavState>()(
  persist(
    (set) => ({
      routes: [],
      push: (route) =>
        set((s) => {
          // Remove any existing occurrence so the new one moves to the front.
          const filtered = s.routes.filter((r) => r !== route)
          return { routes: [route, ...filtered].slice(0, MAX_STORED) }
        }),
    }),
    {
      name: 'abyss:recent-nav',
      partialize: (s) => ({ routes: s.routes }),
    },
  ),
)
