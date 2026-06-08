import { create } from 'zustand'
import type { AgentInstallStatus } from '@/shared/types/agent'
import { ipc } from '@/shared/ipc/ipc.client'
import { reportError } from '@/shared/lib/errors'
import { agentRegistry } from '../registry/agent.registry'

interface AgentAvailabilityState {
  /** Install status (CLI found + version) per agent id. */
  status: Record<string, AgentInstallStatus>
  loaded: boolean
  /** Re-check every registered agent's CLI install status. */
  refresh: () => Promise<void>
}

export const useAgentAvailability = create<AgentAvailabilityState>((set) => ({
  status: {},
  loaded: false,
  refresh: async () => {
    const ids = agentRegistry.getAll().map((a) => a.id)
    // Isolate each install check: one failing agent must not reject the whole
    // refresh (Promise.all would), which would leave `loaded` false and hang
    // the dashboard's AgentCards in a permanent loading state. A failed probe
    // falls back to "not installed" so the UI can still render.
    const entries = await Promise.all(
      ids.map(
        async (id) =>
          [
            id,
            await ipc
              .agentInstallStatus(id)
              .catch((err): AgentInstallStatus => {
                // Log (and mark handled, so the global IPC net stays quiet) but
                // don't toast: a missing/erroring CLI probe is expected and just
                // means "not installed", not a failure worth interrupting the user.
                reportError(err, {
                  title: `Couldn't check ${id} install`,
                  silent: true,
                })
                return { installed: false }
              }),
          ] as const,
      ),
    )
    set({ status: Object.fromEntries(entries), loaded: true })
  },
}))

/** Whether an agent's CLI was found on this machine. */
export function useAgentInstalled(agentId: string): boolean {
  return useAgentAvailability((s) => s.status[agentId]?.installed ?? false)
}
