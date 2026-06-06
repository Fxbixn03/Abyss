import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { agentRegistry } from '@/features/agents/registry/agent.registry'
import { useAgentStore } from '@/features/agents/store/agent.store'
import {
  isAgentEnabled,
  useAgentEnabled,
} from '@/features/agents/store/agent-enabled.store'
import { useShortcutsStore } from '../store/shortcuts.store'
import { comboFromEvent } from '../lib/shortcuts'

/** Global keyboard shortcuts (agent switching + navigation). Mount once. */
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
        case 'agent.next':
          cycle(1)
          break
        case 'agent.prev':
          cycle(-1)
          break
        case 'nav.dashboard':
          navigate('/')
          break
        case 'nav.config':
          navigate('/config')
          break
        case 'nav.settings':
          navigate('/settings')
          break
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [bindings, navigate])
}
