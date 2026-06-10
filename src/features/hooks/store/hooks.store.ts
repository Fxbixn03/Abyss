import { create } from 'zustand'
import type { AgentId } from '@/shared/types/agent'
import type { HookEntry } from '@/shared/types/hooks'
import { ipc } from '@/shared/ipc/ipc.client'
import { reportError } from '@/shared/lib/errors'

interface HooksState {
  agentId: AgentId
  basePath: string
  entries: HookEntry[]
  loading: boolean
  saving: boolean

  load: (agentId: AgentId, basePath: string) => Promise<void>
  upsert: (entry: HookEntry) => Promise<void>
  remove: (id: string) => Promise<void>
  /** Park / un-park a hook without deleting it (moves it between the agent's
   *  config file and Abyss's disabled-hooks store). */
  toggle: (id: string) => Promise<void>
  /** Move a hook up/down within its event+matcher group (Claude runs them in
   *  order). No-op if it's already at the group boundary. */
  move: (id: string, dir: 'up' | 'down') => Promise<void>
}

/**
 * Fetch active (on-disk) and disabled (Abyss-stored) hooks and merge them into
 * one flat list with fresh, collision-free ids — disabled entries carry
 * `disabled: true`.
 */
async function loadMerged(
  agentId: AgentId,
  basePath: string,
): Promise<HookEntry[]> {
  const [active, disabled] = await Promise.all([
    ipc.getHooks(agentId, basePath),
    ipc.getDisabledHooks(agentId, basePath),
  ])
  return [...active, ...disabled].map((e, i) => ({ ...e, id: `h${i}` }))
}

export const useHooksStore = create<HooksState>()((set, get) => ({
  agentId: '',
  basePath: '',
  entries: [],
  loading: false,
  saving: false,

  load: async (agentId, basePath) => {
    set({ agentId, basePath, loading: true })
    try {
      const entries = await loadMerged(agentId, basePath)
      if (get().basePath !== basePath || get().agentId !== agentId) return
      set({ entries, loading: false })
    } catch (err) {
      if (get().basePath === basePath && get().agentId === agentId) {
        set({ loading: false })
      }
      reportError(err, { title: "Couldn't load hooks" })
    }
  },

  upsert: async (entry) => {
    const { entries } = get()
    const exists = entries.some((e) => e.id === entry.id)
    const next = exists
      ? entries.map((e) => (e.id === entry.id ? entry : e))
      : [...entries, entry]
    await persist(set, get, next)
  },

  remove: async (id) => {
    await persist(
      set,
      get,
      get().entries.filter((e) => e.id !== id),
    )
  },

  toggle: async (id) => {
    await persist(
      set,
      get,
      get().entries.map((e) =>
        e.id === id ? { ...e, disabled: !e.disabled } : e,
      ),
    )
  },

  move: async (id, dir) => {
    const { entries } = get()
    const index = entries.findIndex((e) => e.id === id)
    if (index === -1) return
    const entry = entries[index]
    // Find the adjacent entry in the same event+matcher group to swap with.
    const step = dir === 'up' ? -1 : 1
    let swapWith = -1
    for (let i = index + step; i >= 0 && i < entries.length; i += step) {
      if (
        entries[i].event === entry.event &&
        entries[i].matcher === entry.matcher &&
        Boolean(entries[i].disabled) === Boolean(entry.disabled)
      ) {
        swapWith = i
        break
      }
    }
    if (swapWith === -1) return
    const next = [...entries]
    ;[next[index], next[swapWith]] = [next[swapWith], next[index]]
    await persist(set, get, next)
  },
}))

async function persist(
  set: (partial: Partial<HooksState>) => void,
  get: () => HooksState,
  next: HookEntry[],
): Promise<void> {
  const { agentId, basePath, entries: previous } = get()
  if (!basePath) return
  set({ entries: next, saving: true })
  try {
    const active = next.filter((e) => !e.disabled)
    const disabled = next.filter((e) => e.disabled)
    // Write the agent's real config first, then Abyss's disabled store.
    await ipc.setHooks(agentId, basePath, active)
    await ipc.setDisabledHooks(agentId, basePath, disabled)
    // Re-read so ids reflect the canonical on-disk grouping.
    const entries = await loadMerged(agentId, basePath)
    set({ entries })
  } catch (err) {
    set({ entries: previous }) // roll back the optimistic update
    reportError(err, { title: "Couldn't save hooks" })
  } finally {
    set({ saving: false })
  }
}
