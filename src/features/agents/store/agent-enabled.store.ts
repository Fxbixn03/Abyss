import { create } from 'zustand'
import { persist } from 'zustand/middleware'

/** Agents shown in the UI by default; others must be enabled in Settings. */
const DEFAULT_ENABLED = new Set(['claude', 'codex'])

interface AgentEnabledState {
  /** Explicit on/off per agent id; absent → the default for that agent. */
  enabled: Record<string, boolean>
  setEnabled: (id: string, on: boolean) => void
}

export const useAgentEnabled = create<AgentEnabledState>()(
  persist(
    (set) => ({
      enabled: {},
      setEnabled: (id, on) =>
        set((s) => ({ enabled: { ...s.enabled, [id]: on } })),
    }),
    { name: 'abyss-agents-enabled' },
  ),
)

export function isAgentEnabled(
  enabled: Record<string, boolean>,
  id: string,
): boolean {
  return enabled[id] ?? DEFAULT_ENABLED.has(id)
}
