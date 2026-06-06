import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { PromptTemplate } from '../types'
import { BUILTIN_TEMPLATES } from '../presets'

const BUILTIN_IDS = new Set(BUILTIN_TEMPLATES.map((t) => t.id))

interface TemplatesState {
  /** User-created templates (built-ins live in BUILTIN_TEMPLATES). */
  customTemplates: PromptTemplate[]
  /** Edited built-ins, keyed by id — these override the bundled preset. */
  builtinOverrides: Record<string, PromptTemplate>
  /** Ids of built-ins the user deleted (hidden until defaults are restored). */
  hiddenBuiltins: string[]
  addTemplate: (t: Omit<PromptTemplate, 'builtin'>) => void
  updateTemplate: (t: PromptTemplate) => void
  removeTemplate: (id: string) => void
  /** Bring back every built-in to its bundled state (keeps custom templates). */
  restoreDefaults: () => void
}

export const useTemplatesStore = create<TemplatesState>()(
  persist(
    (set) => ({
      customTemplates: [],
      builtinOverrides: {},
      hiddenBuiltins: [],

      addTemplate: (t) =>
        set((s) => ({
          customTemplates: [
            ...s.customTemplates.filter((x) => x.id !== t.id),
            { ...t, builtin: false },
          ],
        })),

      updateTemplate: (t) =>
        set((s) =>
          BUILTIN_IDS.has(t.id)
            ? {
                builtinOverrides: {
                  ...s.builtinOverrides,
                  [t.id]: { ...t, builtin: true },
                },
              }
            : {
                customTemplates: s.customTemplates.map((x) =>
                  x.id === t.id ? { ...t, builtin: false } : x,
                ),
              },
        ),

      removeTemplate: (id) =>
        set((s) =>
          BUILTIN_IDS.has(id)
            ? {
                hiddenBuiltins: s.hiddenBuiltins.includes(id)
                  ? s.hiddenBuiltins
                  : [...s.hiddenBuiltins, id],
              }
            : {
                customTemplates: s.customTemplates.filter((x) => x.id !== id),
              },
        ),

      restoreDefaults: () => set({ builtinOverrides: {}, hiddenBuiltins: [] }),
    }),
    { name: 'abyss-templates' },
  ),
)
