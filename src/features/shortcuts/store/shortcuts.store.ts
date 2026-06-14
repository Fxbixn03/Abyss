import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type ShortcutActionId =
  | 'search.open'
  | 'agent.next'
  | 'agent.prev'
  | 'nav.dashboard'
  | 'nav.config'
  | 'nav.settings'
  | 'nav.mcp'
  | 'nav.hooks'
  | 'nav.doctor'
  | 'nav.snapshots'
  | 'nav.sessions'
  | 'nav.compare'

export const SHORTCUT_ACTIONS: { id: ShortcutActionId; label: string }[] = [
  { id: 'search.open', label: 'Open search' },
  { id: 'agent.next', label: 'Next agent' },
  { id: 'agent.prev', label: 'Previous agent' },
  { id: 'nav.dashboard', label: 'Go to Dashboard' },
  { id: 'nav.config', label: 'Go to Instructions' },
  { id: 'nav.settings', label: 'Go to Settings' },
  { id: 'nav.mcp', label: 'Go to MCP' },
  { id: 'nav.hooks', label: 'Go to Hooks' },
  { id: 'nav.doctor', label: 'Go to Doctor' },
  { id: 'nav.snapshots', label: 'Go to Snapshots' },
  { id: 'nav.sessions', label: 'Go to Sessions' },
  { id: 'nav.compare', label: 'Go to Compare' },
]

export const DEFAULT_BINDINGS: Record<ShortcutActionId, string> = {
  'search.open': 'Ctrl+F',
  'agent.next': 'Alt+ArrowRight',
  'agent.prev': 'Alt+ArrowLeft',
  'nav.dashboard': 'Alt+1',
  'nav.config': 'Alt+2',
  'nav.settings': 'Alt+0',
  'nav.mcp': '',
  'nav.hooks': '',
  'nav.doctor': '',
  'nav.snapshots': '',
  'nav.sessions': '',
  'nav.compare': '',
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
