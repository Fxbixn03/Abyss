import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { PromptTemplate, TemplateUsage } from '../types'
import { BUILTIN_TEMPLATES } from '../presets'

const BUILTIN_IDS = new Set(BUILTIN_TEMPLATES.map((t) => t.id))

interface TemplatesState {
  /** User-created templates (built-ins live in BUILTIN_TEMPLATES). */
  customTemplates: PromptTemplate[]
  /** Edited built-ins, keyed by id — these override the bundled preset. */
  builtinOverrides: Record<string, PromptTemplate>
  /** Ids of built-ins the user deleted (hidden until defaults are restored). */
  hiddenBuiltins: string[]
  /** Pinned template ids (built-in or custom). */
  favorites: string[]
  /** Apply/copy usage per template id, for the "recently used" surface. */
  usage: Record<string, TemplateUsage>
  addTemplate: (t: Omit<PromptTemplate, 'builtin'>) => void
  updateTemplate: (t: PromptTemplate) => void
  removeTemplate: (id: string) => void
  /** Clone a template into a new custom one and return its id. */
  duplicateTemplate: (source: PromptTemplate) => string
  /** Merge an imported pack into the custom templates (id collisions re-keyed). */
  importTemplates: (items: Omit<PromptTemplate, 'builtin'>[]) => number
  toggleFavorite: (id: string) => void
  /** Record an apply/copy so the template floats to the top of "recent". */
  recordUse: (id: string) => void
  /** Bring back every built-in to its bundled state (keeps custom templates). */
  restoreDefaults: () => void
}

function slugify(s: string): string {
  return (
    s
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '') || 'template'
  )
}

/** A short, collision-resistant id derived from a title. */
function newId(title: string, taken: Set<string>): string {
  let id = `${slugify(title)}-${Date.now().toString(36).slice(-4)}`
  while (taken.has(id))
    id = `${slugify(title)}-${Math.random().toString(36).slice(2, 6)}`
  return id
}

export const useTemplatesStore = create<TemplatesState>()(
  persist(
    (set, get) => ({
      customTemplates: [],
      builtinOverrides: {},
      hiddenBuiltins: [],
      favorites: [],
      usage: {},

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
                favorites: s.favorites.filter((f) => f !== id),
              }
            : {
                customTemplates: s.customTemplates.filter((x) => x.id !== id),
                favorites: s.favorites.filter((f) => f !== id),
              },
        ),

      duplicateTemplate: (source) => {
        const taken = new Set([
          ...get().customTemplates.map((t) => t.id),
          ...BUILTIN_IDS,
        ])
        const id = newId(source.title, taken)
        set((s) => ({
          customTemplates: [
            ...s.customTemplates,
            {
              id,
              title: `${source.title} (copy)`,
              description: source.description,
              tags: [...source.tags],
              content: source.content,
              agentIds: source.agentIds ? [...source.agentIds] : undefined,
              builtin: false,
            },
          ],
        }))
        return id
      },

      importTemplates: (items) => {
        if (items.length === 0) return 0
        set((s) => {
          const taken = new Set([
            ...s.customTemplates.map((t) => t.id),
            ...BUILTIN_IDS,
          ])
          const added: PromptTemplate[] = []
          for (const item of items) {
            const id = taken.has(item.id) ? newId(item.title, taken) : item.id
            taken.add(id)
            added.push({ ...item, id, builtin: false })
          }
          return { customTemplates: [...s.customTemplates, ...added] }
        })
        return items.length
      },

      toggleFavorite: (id) =>
        set((s) => ({
          favorites: s.favorites.includes(id)
            ? s.favorites.filter((f) => f !== id)
            : [...s.favorites, id],
        })),

      recordUse: (id) =>
        set((s) => ({
          usage: {
            ...s.usage,
            [id]: { count: (s.usage[id]?.count ?? 0) + 1, at: Date.now() },
          },
        })),

      restoreDefaults: () => set({ builtinOverrides: {}, hiddenBuiltins: [] }),
    }),
    { name: 'abyss-templates' },
  ),
)
