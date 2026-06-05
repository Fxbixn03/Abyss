import { useEffect } from 'react'
import { useActiveAgentId } from '@/features/agents/hooks/useActiveAgent'
import { applyTheme } from '../lib/applyTheme'
import { useThemeStore } from '../store/theme.store'

/**
 * Watches the active agent + theme selections + appearance and applies the
 * resulting palette to :root. Mount once at the app root.
 */
export function useThemeApplier(): void {
  const activeAgentId = useActiveAgentId()
  const appearance = useThemeStore((s) => s.appearance)
  const agentThemeMap = useThemeStore((s) => s.agentThemeMap)
  const customThemes = useThemeStore((s) => s.customThemes)
  const getActiveTheme = useThemeStore((s) => s.getActiveTheme)

  useEffect(() => {
    applyTheme(getActiveTheme(activeAgentId), appearance)
    // agentThemeMap & customThemes are dependencies so re-selecting re-applies.
  }, [activeAgentId, appearance, agentThemeMap, customThemes, getActiveTheme])
}
