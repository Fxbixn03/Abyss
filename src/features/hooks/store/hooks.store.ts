import { create } from 'zustand'
import type { AgentId } from '@/shared/types/agent'
import type { HookEntry } from '@/shared/types/hooks'
import { ipc } from '@/shared/ipc/ipc.client'

interface HooksState {
  agentId: AgentId
  basePath: string
  entries: HookEntry[]
  loading: boolean
  saving: boolean

  load: (agentId: AgentId, basePath: string) => Promise<void>
  upsert: (entry: HookEntry) => Promise<void>
  remove: (id: string) => Promise<void>
}

export const useHooksStore = create<HooksState>()((set, get) => ({
  agentId: '',
  basePath: '',
  entries: [],
  loading: false,
  saving: false,

  load: async (agentId, basePath) => {
    set({ agentId, basePath, loading: true })
    const entries = await ipc.getHooks(agentId, basePath)
    if (get().basePath !== basePath || get().agentId !== agentId) return
    set({ entries, loading: false })
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
}))

async function persist(
  set: (partial: Partial<HooksState>) => void,
  get: () => HooksState,
  next: HookEntry[],
): Promise<void> {
  const { agentId, basePath } = get()
  if (!basePath) return
  set({ entries: next, saving: true })
  await ipc.setHooks(agentId, basePath, next)
  // Re-read so ids reflect the canonical on-disk grouping.
  const entries = await ipc.getHooks(agentId, basePath)
  set({ entries, saving: false })
}
