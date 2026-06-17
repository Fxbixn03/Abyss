import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface ComposerDraftsState {
  /** Maps draftKey (sessionId or 'new') → draft text. */
  drafts: Record<string, string>
  /** Set or clear the draft for a given key. */
  setDraft: (key: string, text: string) => void
  /** Remove the draft for a given key (after a successful submit). */
  clearDraft: (key: string) => void
}

export const useComposerDraftsStore = create<ComposerDraftsState>()(
  persist(
    (set) => ({
      drafts: {},
      setDraft: (key, text) =>
        set((s) => ({ drafts: { ...s.drafts, [key]: text } })),
      clearDraft: (key) =>
        set((s) => {
          const next = { ...s.drafts }
          delete next[key]
          return { drafts: next }
        }),
    }),
    {
      name: 'abyss-composer-drafts',
      partialize: (s) => ({ drafts: s.drafts }),
    },
  ),
)
