import { create } from 'zustand'
import type { AgentId } from '@/shared/types/agent'
import type { McpHealthResult, McpServerEntry } from '@/shared/types/config'
import { ipc } from '@/shared/ipc/ipc.client'
import { reportError, isConfigParseError } from '@/shared/lib/errors'
import type { ConfigParseInfo } from '@/shared/lib/errors'
import { genId } from '@/shared/lib/id'

export type McpHealthState = { loading: true } | McpHealthResult

interface McpState {
  agentId: AgentId | null
  basePath: string
  /** Project dir when in project scope (→ `.mcp.json`); undefined = global. */
  projectDir: string | undefined
  servers: McpServerEntry[]
  loading: boolean
  saving: boolean
  /** Set when the config file on disk is corrupt → renderer offers a repair. */
  parseError: ConfigParseInfo | null
  /** Last "test connection" result per server id. */
  health: Record<string, McpHealthState>
  /** In-flight health-check requestIds per server id (for cancellation). */
  testRequests: Record<string, string>

  load: (
    agentId: AgentId,
    basePath: string,
    projectDir?: string,
  ) => Promise<void>
  upsert: (entry: McpServerEntry) => Promise<void>
  remove: (id: string) => Promise<void>
  toggle: (id: string) => Promise<void>
  test: (entry: McpServerEntry) => Promise<void>
  /** Abort every in-flight health check (e.g. when leaving the MCP page). */
  cancelTests: () => void
}

export const useMcpStore = create<McpState>()((set, get) => ({
  agentId: null,
  basePath: '',
  projectDir: undefined,
  servers: [],
  loading: false,
  saving: false,
  parseError: null,
  health: {},
  testRequests: {},

  load: async (agentId, basePath, projectDir) => {
    set({ agentId, basePath, projectDir, loading: true, parseError: null })
    try {
      const servers = await ipc.getMcpServers(agentId, basePath, projectDir)
      if (
        get().agentId !== agentId ||
        get().basePath !== basePath ||
        get().projectDir !== projectDir
      ) {
        return
      }
      set({ servers, loading: false })
    } catch (err) {
      // Only act if this load is still the current one.
      const current = get().basePath === basePath && get().agentId === agentId
      if (isConfigParseError(err)) {
        // A corrupt file isn't a transient failure — show the repair banner
        // instead of a toast that vanishes.
        if (current) {
          set({ loading: false, servers: [], parseError: { message: err.message, filePath: err.filePath } })
        }
      } else {
        if (current) set({ loading: false })
        reportError(err, { title: "Couldn't load MCP servers" })
      }
    }
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
    // Supersede any in-flight check for this server so we don't leave an
    // orphaned probe running on the main side.
    const prev = get().testRequests[entry.id]
    if (prev) void ipc.cancelRequest(prev)
    const requestId = genId()
    set({
      health: { ...get().health, [entry.id]: { loading: true } },
      testRequests: { ...get().testRequests, [entry.id]: requestId },
    })
    try {
      const result = await ipc.mcpHealthCheck(entry, requestId)
      // Drop a stale result if a newer test (or a cancel) superseded this one.
      if (get().testRequests[entry.id] !== requestId) return
      const testRequests = { ...get().testRequests }
      delete testRequests[entry.id]
      set({ health: { ...get().health, [entry.id]: result }, testRequests })
    } catch (err) {
      if (get().testRequests[entry.id] !== requestId) return
      const health = { ...get().health }
      delete health[entry.id]
      const testRequests = { ...get().testRequests }
      delete testRequests[entry.id]
      set({ health, testRequests })
      reportError(err, { title: "Couldn't test MCP server" })
    }
  },

  cancelTests: () => {
    const { testRequests, health } = get()
    for (const requestId of Object.values(testRequests)) {
      void ipc.cancelRequest(requestId)
    }
    // Clear the in-progress spinners; settled results stay as-is.
    const nextHealth: Record<string, McpHealthState> = {}
    for (const [id, state] of Object.entries(health)) {
      if (!('loading' in state)) nextHealth[id] = state
    }
    set({ testRequests: {}, health: nextHealth })
  },
}))

async function persist(
  set: (partial: Partial<McpState>) => void,
  get: () => McpState,
  next: McpServerEntry[],
): Promise<void> {
  const { agentId, basePath, projectDir, servers: previous } = get()
  if (!agentId || !basePath) return
  set({ servers: next, saving: true })
  try {
    await ipc.setMcpServers(agentId, basePath, next, projectDir)
  } catch (err) {
    set({ servers: previous }) // roll back the optimistic update
    reportError(err, { title: "Couldn't save MCP servers" })
  } finally {
    set({ saving: false })
  }
}
