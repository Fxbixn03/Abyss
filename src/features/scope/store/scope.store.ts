import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type ConfigScope = 'global' | 'project'

interface ScopeState {
  /** Whether config surfaces operate on the global or a project's config. */
  scope: ConfigScope
  /** The active project directory (absolute), when in project scope. */
  projectDir: string | null
  /** Recently used project directories, most-recent first. */
  recentProjects: string[]

  setScope: (scope: ConfigScope) => void
  /** Select a project dir and switch to project scope. */
  setProject: (dir: string) => void
  removeRecent: (dir: string) => void
}

const MAX_RECENT = 8

export const useScopeStore = create<ScopeState>()(
  persist(
    (set, get) => ({
      scope: 'global',
      projectDir: null,
      recentProjects: [],

      setScope: (scope) => set({ scope }),

      setProject: (dir) =>
        set({
          scope: 'project',
          projectDir: dir,
          recentProjects: [
            dir,
            ...get().recentProjects.filter((d) => d !== dir),
          ].slice(0, MAX_RECENT),
        }),

      removeRecent: (dir) =>
        set((s) => ({
          recentProjects: s.recentProjects.filter((d) => d !== dir),
          projectDir: s.projectDir === dir ? null : s.projectDir,
        })),
    }),
    { name: 'abyss-scope' },
  ),
)
