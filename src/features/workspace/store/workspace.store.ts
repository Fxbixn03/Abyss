import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface WorkspaceState {
  /** Last root folder the user scanned, re-scanned on next visit. */
  lastRoot: string | null
  setLastRoot: (dir: string | null) => void
}

export const useWorkspaceStore = create<WorkspaceState>()(
  persist(
    (set) => ({
      lastRoot: null,
      setLastRoot: (dir) => set({ lastRoot: dir }),
    }),
    { name: 'abyss-workspace' },
  ),
)
