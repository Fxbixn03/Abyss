import { create } from 'zustand'
import type { AgentId } from '@/shared/types/agent'
import type { McpServerEntry } from '@/shared/types/config'
import { ipc } from '@/shared/ipc/ipc.client'

interface McpState {
  agentId: AgentId | null
  basePath: string
  servers: McpServerEntry[]
  loading: boolean
  saving: boolean

  load: (agentId: AgentId, basePath: string) => Promise<void>
  upsert: (entry: McpServerEntry) => Promise<void>
  remove: (id: string) => Promise<void>
  toggle: (id: string) => Promise<void>
}

export const useMcpStore = create<McpState>()((set, get) => ({
  agentId: null,
  basePath: '',
  servers: [],
  loading: false,
  saving: false,

  load: async (agentId, basePath) => {
    set({ agentId, basePath, loading: true })
    const servers = await ipc.getMcpServers(agentId, basePath)
    if (get().agentId !== agentId || get().basePath !== basePath) return
    set({ servers, loading: false })
  },

  upsert: async (entry) => {
    const { servers } = get()
    const exists = servers.some((s) => s.id === entry.id)
    const next = exists
      ? servers.map((s) => (s.id === entry.id ? entry : s))
      : [...servers, entry]
    await persist(set, get, next)
  },

  remove: async (id) => {
    await persist(set, get, get().servers.filter((s) => s.id !== id))
  },

  toggle: async (id) => {
    await persist(
      set,
      get,
      get().servers.map((s) =>
        s.id === id ? { ...s, enabled: !s.enabled } : s,
      ),
    )
  },
}))

async function persist(
  set: (partial: Partial<McpState>) => void,
  get: () => McpState,
  next: McpServerEntry[],
): Promise<void> {
  const { agentId, basePath } = get()
  if (!agentId || !basePath) return
  set({ servers: next, saving: true })
  await ipc.setMcpServers(agentId, basePath, next)
  set({ saving: false })
}
