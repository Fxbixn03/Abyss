import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { SortOrder, GroupBy } from '../lib/session-list'

interface SessionListPrefsState {
  sortOrder: SortOrder
  groupBy: GroupBy
  setSortOrder: (sortOrder: SortOrder) => void
  setGroupBy: (groupBy: GroupBy) => void
}

export const useSessionListPrefsStore = create<SessionListPrefsState>()(
  persist(
    (set) => ({
      sortOrder: 'recent',
      groupBy: 'project',
      setSortOrder: (sortOrder) => set({ sortOrder }),
      setGroupBy: (groupBy) => set({ groupBy }),
    }),
    {
      name: 'abyss-chat-session-list-prefs',
      partialize: (s) => ({ sortOrder: s.sortOrder, groupBy: s.groupBy }),
    },
  ),
)
