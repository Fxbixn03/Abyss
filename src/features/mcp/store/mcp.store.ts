import { create } from 'zustand'
import type { AgentId } from '@/shared/types/agent'
import type { McpHealthResult, McpServerEntry } from '@/shared/types/config'
import { ipc } from '@/shared/ipc/ipc.client'

export type McpHealthState = { loading: true } | McpHealthResult

interface McpState {
  agentId: AgentId | null
  basePath: string
  servers: McpServerEntry[]
  loading: boolean
  saving: boolean
  /** Last "test connection" result per server id. */
  health: Record<string, McpHealthState>

  load: (agentId: AgentId, basePath: string) => Promise<void>
  upsert: (entry: McpServerEntry) => Promise<void>
  remove: (id: string) => Promise<void>
  toggle: (id: string) => Promise<void>
  test: (entry: McpServerEntry) => Promise<void>
}

export const useMcpStore = create<McpState>()((set, get) => ({
  agentId: null,
  basePath: '',
  servers: [],
  loading: false,
  saving: false,
  health: {},

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
    await persist(
      set,
      get,
      get().servers.filter((s) => s.id !== id),
    )
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

  test: async (entry) => {
    set({ health: { ...get().health, [entry.id]: { loading: true } } })
    const result = await ipc.mcpHealthCheck(entry)
    set({ health: { ...get().health, [entry.id]: result } })
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
