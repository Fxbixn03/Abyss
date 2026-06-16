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
          void navigate('/')
          break
        case 'nav.config':
          void navigate('/config')
          break
        case 'nav.settings':
          void navigate('/settings')
          break
        case 'nav.mcp':
          void navigate('/mcp')
          break
        case 'nav.hooks':
          void navigate('/hooks')
          break
        case 'nav.doctor':
          void navigate('/doctor')
          break
        case 'nav.snapshots':
          void navigate('/history')
          break
        case 'nav.sessions':
          void navigate('/sessions')
          break
        case 'nav.compare':
          void navigate('/compare')
          break
        case 'nav.permissions':
          void navigate('/permissions')
          break
        case 'nav.workspace':
          void navigate('/workspace')
          break
        case 'nav.profiles':
          void navigate('/profiles')
          break
        case 'nav.bundles':
          void navigate('/bundles')
          break
        case 'nav.usage':
          void navigate('/usage')
          break
        case 'nav.context':
          void navigate('/context')
          break
        case 'nav.templates':
          void navigate('/templates')
          break
        case 'nav.sandbox':
          void navigate('/sandbox')
          break
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [bindings, navigate])
}
