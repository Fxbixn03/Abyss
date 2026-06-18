import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { ChatPermissionMode } from '@/shared/types/chat'

export interface ComposerPrefs {
  model: string
  permissionMode: ChatPermissionMode
}

interface ComposerPrefsState {
  /** Maps sessionKey (sessionId or 'new') → { model, permissionMode }. */
  prefs: Record<string, ComposerPrefs>
  /** Whether the settings bar (permission-mode + model selects) is collapsed. */
  settingsBarCollapsed: boolean
  /** Update the model for a given key. */
  setModel: (key: string, model: string) => void
  /** Update the permissionMode for a given key. */
  setPermissionMode: (key: string, permissionMode: ChatPermissionMode) => void
  /** Toggle or set the settings bar collapsed state. */
  setSettingsBarCollapsed: (collapsed: boolean) => void
}

const DEFAULT_PREFS: ComposerPrefs = {
  model: 'default',
  permissionMode: 'default',
}

export const useComposerPrefsStore = create<ComposerPrefsState>()(
  persist(
    (set) => ({
      prefs: {},
      settingsBarCollapsed: false,
      setModel: (key, model) =>
        set((s) => ({
          prefs: {
            ...s.prefs,
            [key]: { ...(s.prefs[key] ?? DEFAULT_PREFS), model },
          },
        })),
      setPermissionMode: (key, permissionMode) =>
        set((s) => ({
          prefs: {
            ...s.prefs,
            [key]: { ...(s.prefs[key] ?? DEFAULT_PREFS), permissionMode },
          },
        })),
      setSettingsBarCollapsed: (collapsed) =>
        set({ settingsBarCollapsed: collapsed }),
    }),
    {
      name: 'abyss-composer-prefs',
      partialize: (s) => ({
        prefs: s.prefs,
        settingsBarCollapsed: s.settingsBarCollapsed,
      }),
    },
  ),
)

/** Returns the persisted prefs for a session key, falling back to defaults. */
export function getComposerPrefs(
  prefs: Record<string, ComposerPrefs>,
  key: string,
): ComposerPrefs {
  return prefs[key] ?? DEFAULT_PREFS
}
