import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type ShortcutActionId =
  | 'search.open'
  | 'agent.next'
  | 'agent.prev'
  | 'appearance.toggle'
  | 'nav.dashboard'
  | 'nav.config'
  | 'nav.settings'
  | 'nav.mcp'
  | 'nav.hooks'
  | 'nav.doctor'
  | 'nav.snapshots'
  | 'nav.sessions'
  | 'nav.compare'
  | 'nav.permissions'
  | 'nav.workspace'
  | 'nav.profiles'
  | 'nav.bundles'
  | 'nav.usage'
  | 'nav.context'
  | 'nav.templates'
  | 'nav.sandbox'

export const SHORTCUT_ACTIONS: { id: ShortcutActionId; label: string }[] = [
  { id: 'search.open', label: 'Open search' },
  { id: 'agent.next', label: 'Next agent' },
  { id: 'agent.prev', label: 'Previous agent' },
  { id: 'appearance.toggle', label: 'Toggle light / dark' },
  { id: 'nav.dashboard', label: 'Go to Dashboard' },
  { id: 'nav.config', label: 'Go to Instructions' },
  { id: 'nav.settings', label: 'Go to Settings' },
  { id: 'nav.mcp', label: 'Go to MCP' },
  { id: 'nav.hooks', label: 'Go to Hooks' },
  { id: 'nav.doctor', label: 'Go to Doctor' },
  { id: 'nav.snapshots', label: 'Go to Snapshots' },
  { id: 'nav.sessions', label: 'Go to Sessions' },
  { id: 'nav.compare', label: 'Go to Compare' },
  { id: 'nav.permissions', label: 'Go to Permissions' },
  { id: 'nav.workspace', label: 'Go to Workspace' },
  { id: 'nav.profiles', label: 'Go to Profiles' },
  { id: 'nav.bundles', label: 'Go to Bundles' },
  { id: 'nav.usage', label: 'Go to Analytics' },
  { id: 'nav.context', label: 'Go to Context' },
  { id: 'nav.templates', label: 'Go to Templates' },
  { id: 'nav.sandbox', label: 'Go to Sandbox' },
]

export const DEFAULT_BINDINGS: Record<ShortcutActionId, string> = {
  'search.open': 'Ctrl+F',
  'agent.next': 'Alt+ArrowRight',
  'agent.prev': 'Alt+ArrowLeft',
  'appearance.toggle': 'Alt+T',
  'nav.dashboard': 'Alt+1',
  'nav.config': 'Alt+2',
  'nav.settings': 'Alt+0',
  'nav.mcp': '',
  'nav.hooks': '',
  'nav.doctor': '',
  'nav.snapshots': '',
  'nav.sessions': '',
  'nav.compare': '',
  'nav.permissions': '',
  'nav.workspace': '',
  'nav.profiles': '',
  'nav.bundles': '',
  'nav.usage': '',
  'nav.context': '',
  'nav.templates': '',
  'nav.sandbox': '',
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
