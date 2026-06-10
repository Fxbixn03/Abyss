import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { PermissionRules } from '@/shared/types/config'

/** A user-saved permission preset, reusable across projects. */
export interface CustomPreset {
  id: string
  label: string
  rules: PermissionRules
}

interface CustomPresetsState {
  presets: CustomPreset[]
  /** Save the given rules under a name; returns the created preset. */
  add: (label: string, rules: PermissionRules) => void
  remove: (id: string) => void
}

export const useCustomPresets = create<CustomPresetsState>()(
  persist(
    (set) => ({
      presets: [],
      add: (label, rules) =>
        set((s) => ({
          presets: [
            ...s.presets,
            {
              id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
              label: label.trim(),
              // Deep-copy so later edits don't mutate the stored preset.
              rules: {
                allow: [...rules.allow],
                deny: [...rules.deny],
                ask: [...rules.ask],
                defaultMode: rules.defaultMode,
                additionalDirectories: rules.additionalDirectories
                  ? [...rules.additionalDirectories]
                  : undefined,
              },
            },
          ],
        })),
      remove: (id) =>
        set((s) => ({ presets: s.presets.filter((p) => p.id !== id) })),
    }),
    { name: 'abyss-permission-presets' },
  ),
)
