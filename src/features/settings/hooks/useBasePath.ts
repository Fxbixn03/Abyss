import type { AgentId } from '@/shared/types/agent'
import { useSettingsStore } from '../store/settings.store'

/** Reactive effective base path for an agent. */
export function useBasePath(agentId: AgentId): string {
  // Subscribe to the inputs so the value recomputes when either changes.
  const settings = useSettingsStore((s) => s.settings)
  const detected = useSettingsStore((s) => s.detected)
  const getBasePath = useSettingsStore((s) => s.getBasePath)
  void settings
  void detected
  return getBasePath(agentId)
}
