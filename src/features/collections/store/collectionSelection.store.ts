import { create } from 'zustand'
import type { CollectionKind } from '@/shared/types/collections'

interface CollectionSelectionState {
  /** An item the command palette asked to open, consumed by CollectionManager. */
  pending: { kind: CollectionKind; id: string } | null
  requestOpen: (kind: CollectionKind, id: string) => void
  /** Take the pending id for `kind` (and clear it), or null. */
  consume: (kind: CollectionKind) => string | null
}

export const useCollectionSelection = create<CollectionSelectionState>(
  (set, get) => ({
    pending: null,
    requestOpen: (kind, id) => set({ pending: { kind, id } }),
    consume: (kind) => {
      const p = get().pending
      if (p && p.kind === kind) {
        set({ pending: null })
        return p.id
      }
      return null
    },
  }),
)
