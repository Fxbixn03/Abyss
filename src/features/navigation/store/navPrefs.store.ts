import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { NavItem } from '@/app/navigation'

interface NavPrefsState {
  /** Per-agent list of hidden nav item ids. */
  hidden: Record<string, string[]>
  /** Per-agent explicit nav item order (ids). Items missing keep base order. */
  order: Record<string, string[]>
  toggleHidden: (agentId: string, id: string) => void
  /** Move an id up/down within the agent's effective ordering. */
  move: (agentId: string, orderedIds: string[], id: string, dir: 'up' | 'down') => void
  resetAgent: (agentId: string) => void
}

export const useNavPrefsStore = create<NavPrefsState>()(
  persist(
    (set) => ({
      hidden: {},
      order: {},
      toggleHidden: (agentId, id) =>
        set((s) => {
          const current = s.hidden[agentId] ?? []
          const next = current.includes(id)
            ? current.filter((x) => x !== id)
            : [...current, id]
          return { hidden: { ...s.hidden, [agentId]: next } }
        }),
      move: (agentId, orderedIds, id, dir) =>
        set((s) => {
          const ids = [...orderedIds]
          const from = ids.indexOf(id)
          const to = dir === 'up' ? from - 1 : from + 1
          if (from === -1 || to < 0 || to >= ids.length) return s
          ;[ids[from], ids[to]] = [ids[to]!, ids[from]!]
          return { order: { ...s.order, [agentId]: ids } }
        }),
      resetAgent: (agentId) =>
        set((s) => {
          const hidden = { ...s.hidden }
          const order = { ...s.order }
          delete hidden[agentId]
          delete order[agentId]
          return { hidden, order }
        }),
    }),
    { name: 'abyss:nav-prefs' },
  ),
)

/** Whether a nav id is hidden for the given agent. */
export function isNavHidden(
  hidden: Record<string, string[]>,
  agentId: string,
  id: string,
): boolean {
  return (hidden[agentId] ?? []).includes(id)
}

/**
 * Apply the user's saved per-agent order to a base nav list. Items present in
 * the saved order come first in that order; any new items keep their base
 * position appended afterwards, so adding a page never hides it.
 */
export function applyNavOrder(items: NavItem[], order: string[] | undefined): NavItem[] {
  if (!order || order.length === 0) return items
  const byId = new Map(items.map((it) => [it.id, it]))
  const out: NavItem[] = []
  for (const id of order) {
    const it = byId.get(id)
    if (it) {
      out.push(it)
      byId.delete(id)
    }
  }
  // Remaining (newly-added) items keep their original relative order.
  for (const it of items) if (byId.has(it.id)) out.push(it)
  return out
}
