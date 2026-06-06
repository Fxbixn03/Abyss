import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { PromptTemplate } from '../types'
import { BUILTIN_TEMPLATES } from '../presets'

interface TemplatesState {
  /** User-created templates (built-ins live in BUILTIN_TEMPLATES). */
  customTemplates: PromptTemplate[]
  addTemplate: (t: Omit<PromptTemplate, 'builtin'>) => void
  removeTemplate: (id: string) => void
  allTemplates: () => PromptTemplate[]
}

export const useTemplatesStore = create<TemplatesState>()(
  persist(
    (set, get) => ({
      customTemplates: [],
      addTemplate: (t) =>
        set((s) => ({
          customTemplates: [
            ...s.customTemplates.filter((x) => x.id !== t.id),
            { ...t, builtin: false },
          ],
        })),
      removeTemplate: (id) =>
        set((s) => ({
          customTemplates: s.customTemplates.filter((x) => x.id !== id),
        })),
      allTemplates: () => [...get().customTemplates, ...BUILTIN_TEMPLATES],
    }),
    { name: 'abyss-templates' },
  ),
)
