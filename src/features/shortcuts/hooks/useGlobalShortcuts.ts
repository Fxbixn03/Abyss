import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { agentRegistry } from '@/features/agents/registry/agent.registry'
import { useAgentStore } from '@/features/agents/store/agent.store'
import {
  isAgentEnabled,
  useAgentEnabled,
} from '@/features/agents/store/agent-enabled.store'
import { useCommandPalette } from '@/app/command/commandPalette.store'
import { useThemeStore } from '@/features/themes/store/theme.store'
import { useSettingsStore } from '@/features/settings/store/settings.store'
import { isBetaRoute } from '@/app/navigation'
import { useShortcutsStore } from '../store/shortcuts.store'
import { comboFromEvent } from '../lib/shortcuts'

/** Global keyboard shortcuts (search, agent switching + navigation). Mount once. */
export function useGlobalShortcuts(): void {
  const bindings = useShortcutsStore((s) => s.bindings)
  const navigate = useNavigate()

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const combo = comboFromEvent(e)
      if (!combo) return
      const actionId = Object.keys(bindings).find(
        (id) => bindings[id] === combo,
      )
      if (!actionId) return
      e.preventDefault()

      const enabled = useAgentEnabled.getState().enabled
      const agents = agentRegistry
        .getAll()
        .filter((a) => isAgentEnabled(enabled, a.id))
      const store = useAgentStore.getState()
      // When beta features are off, beta-route shortcuts become no-ops.
      const betaOff = !useSettingsStore.getState().settings.betaFeatures
      const go = (route: string) => {
        if (betaOff && isBetaRoute(route)) return
        void navigate(route)
      }
      const cycle = (dir: number) => {
        if (agents.length < 2) return
        const idx = agents.findIndex((a) => a.id === store.activeAgentId)
        const next = agents[(idx + dir + agents.length) % agents.length]
        store.setActiveAgent(next.id)
      }

      switch (actionId) {
        case 'search.open':
          useCommandPalette.getState().setOpen(true)
          break
        case 'agent.next':
          cycle(1)
          break
        case 'agent.prev':
          cycle(-1)
          break
        case 'appearance.toggle':
          useThemeStore.getState().toggleAppearance()
          break
        case 'nav.dashboard':
          go('/')
          break
        case 'nav.config':
          go('/config')
          break
        case 'nav.settings':
          go('/settings')
          break
        case 'nav.mcp':
          go('/mcp')
          break
        case 'nav.hooks':
          go('/hooks')
          break
        case 'nav.doctor':
          go('/doctor')
          break
        case 'nav.snapshots':
          go('/history')
          break
        case 'nav.sessions':
          go('/sessions')
          break
        case 'nav.compare':
          go('/compare')
          break
        case 'nav.permissions':
          go('/permissions')
          break
        case 'nav.workspace':
          go('/workspace')
          break
        case 'nav.profiles':
          go('/profiles')
          break
        case 'nav.bundles':
          go('/bundles')
          break
        case 'nav.usage':
          go('/usage')
          break
        case 'nav.context':
          go('/context')
          break
        case 'nav.templates':
          go('/templates')
          break
        case 'nav.sandbox':
          go('/sandbox')
          break
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [bindings, navigate])
}
