import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface SidebarState {
  collapsed: boolean
  toggle: () => void
  setCollapsed: (collapsed: boolean) => void
  /** Sidebar group ids the user has collapsed (hidden). */
  collapsedGroups: string[]
  toggleGroup: (id: string) => void
}

export const useSidebarStore = create<SidebarState>()(
  persist(
    (set) => ({
      collapsed: false,
      toggle: () => set((s) => ({ collapsed: !s.collapsed })),
      setCollapsed: (collapsed) => set({ collapsed }),
      collapsedGroups: [],
      toggleGroup: (id) =>
        set((s) => ({
          collapsedGroups: s.collapsedGroups.includes(id)
            ? s.collapsedGroups.filter((g) => g !== id)
            : [...s.collapsedGroups, id],
        })),
    }),
    {
      name: 'abyss:sidebar:collapsed',
      partialize: (s) => ({
        collapsed: s.collapsed,
        collapsedGroups: s.collapsedGroups,
      }),
    },
  ),
)
