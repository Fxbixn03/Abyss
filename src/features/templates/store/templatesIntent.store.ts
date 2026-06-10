import { create } from 'zustand'

interface TemplatesIntentState {
  /** A template id the command palette asked to apply, consumed by the page. */
  pendingApplyId: string | null
  requestApply: (id: string) => void
  /** Take the pending id (and clear it), or null. */
  consume: () => string | null
}

export const useTemplatesIntent = create<TemplatesIntentState>((set, get) => ({
  pendingApplyId: null,
  requestApply: (id) => set({ pendingApplyId: id }),
  consume: () => {
    const id = get().pendingApplyId
    if (id) set({ pendingApplyId: null })
    return id
  },
}))
