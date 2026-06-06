import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type ShortcutActionId =
  | 'agent.next'
  | 'agent.prev'
  | 'nav.dashboard'
  | 'nav.config'
  | 'nav.settings'

export const SHORTCUT_ACTIONS: { id: ShortcutActionId; label: string }[] = [
  { id: 'agent.next', label: 'Next agent' },
  { id: 'agent.prev', label: 'Previous agent' },
  { id: 'nav.dashboard', label: 'Go to Dashboard' },
  { id: 'nav.config', label: 'Go to Instructions' },
  { id: 'nav.settings', label: 'Go to Settings' },
]

export const DEFAULT_BINDINGS: Record<ShortcutActionId, string> = {
  'agent.next': 'Alt+ArrowRight',
  'agent.prev': 'Alt+ArrowLeft',
  'nav.dashboard': 'Alt+1',
  'nav.config': 'Alt+2',
  'nav.settings': 'Alt+0',
}

interface ShortcutsState {
  bindings: Record<string, string>
  setBinding: (id: ShortcutActionId, combo: string) => void
  resetAll: () => void
}

export const useShortcutsStore = create<ShortcutsState>()(
  persist(
    (set) => ({
      bindings: { ...DEFAULT_BINDINGS },
      setBinding: (id, combo) =>
        set((s) => ({ bindings: { ...s.bindings, [id]: combo } })),
      resetAll: () => set({ bindings: { ...DEFAULT_BINDINGS } }),
    }),
    {
      name: 'abyss-shortcuts',
      // Merge in any newly-added default actions on top of persisted bindings.
      merge: (persisted, current) => {
        const p = persisted as Partial<ShortcutsState> | undefined
        return {
          ...current,
          ...p,
          bindings: { ...DEFAULT_BINDINGS, ...(p?.bindings ?? {}) },
        }
      },
    },
  ),
)
