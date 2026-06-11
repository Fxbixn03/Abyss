import { create } from 'zustand'
import type { CustomAgentSpec } from '@/shared/agents/custom-agent'
import {
  customAgentToDefinition,
  sidebarSectionsForCapabilities,
} from '@/shared/agents/custom-agent'
import {
  getCustomAgentIds,
  setCustomAgentDefinitions,
} from '@/shared/agents/defs'
import { ipc } from '@/shared/ipc/ipc.client'
import { reportError } from '@/shared/lib/errors'
import { createAdapter } from '../adapters/base.adapter'
import { agentRegistry } from '../registry/agent.registry'
import {
  validateJsonContent,
  validateMarkdownInstructions,
} from '../lib/validators'
import { useAgentStore } from './agent.store'
import { useAgentEnabled, isAgentEnabled } from './agent-enabled.store'
import { useAgentIconStore } from './agent-icon.store'

/** Pick the validator that matches the custom agent's instruction language. */
function buildAdapter(spec: CustomAgentSpec) {
  const validate =
    spec.instructions.language === 'json'
      ? validateJsonContent
      : spec.instructions.language === 'markdown'
        ? validateMarkdownInstructions
        : undefined
  return createAdapter(customAgentToDefinition(spec), {
    icon: spec.iconName,
    validate,
    getSidebarSections: () => sidebarSectionsForCapabilities(spec.capabilities),
  })
}

/**
 * Reconcile the renderer's definition registry + adapter registry with the given
 * set of custom agent specs: register/replace each spec's adapter and drop any
 * adapter whose agent was removed. The previously synced ids come straight from
 * the shared definition registry, so no extra bookkeeping is needed.
 */
function syncCustomAgents(specs: CustomAgentSpec[]): void {
  const prevIds = getCustomAgentIds()
  const nextIds = new Set(specs.map((s) => s.id))
  setCustomAgentDefinitions(specs)
  for (const id of prevIds) {
    if (!nextIds.has(id)) agentRegistry.unregister(id)
  }
  for (const spec of specs) {
    agentRegistry.register(buildAdapter(spec))
  }
}

interface CustomAgentState {
  /** The user's custom agents (source of truth for reactive UI). */
  specs: CustomAgentSpec[]
  /** Load specs from settings on boot and register their adapters. */
  hydrate: (specs: CustomAgentSpec[]) => void
  /** Create or update a custom agent (registers it and persists to disk). */
  save: (spec: CustomAgentSpec) => Promise<void>
  /** Delete a custom agent and clean up its UI overrides. */
  remove: (id: string) => Promise<void>
}

export const useCustomAgentStore = create<CustomAgentState>()((set, get) => ({
  specs: [],

  hydrate: (specs) => {
    syncCustomAgents(specs)
    set({ specs })
  },

  save: async (spec) => {
    const existing = get().specs.some((s) => s.id === spec.id)
    const next = existing
      ? get().specs.map((s) => (s.id === spec.id ? spec : s))
      : [...get().specs, spec]
    syncCustomAgents(next)
    set({ specs: next })
    // New agents are visible immediately; existing ones keep their toggle state.
    if (!existing) useAgentEnabled.getState().setEnabled(spec.id, true)
    try {
      await ipc.setSettings({ customAgents: next })
    } catch (err) {
      reportError(err, { title: "Couldn't save custom agent" })
    }
  },

  remove: async (id) => {
    const next = get().specs.filter((s) => s.id !== id)
    syncCustomAgents(next)
    set({ specs: next })
    // Drop any per-agent icon override; fall back to another agent if the
    // deleted one was active.
    useAgentIconStore.getState().resetIcon(id)
    const agentStore = useAgentStore.getState()
    if (agentStore.activeAgentId === id) {
      const enabledMap = useAgentEnabled.getState().enabled
      const fallback =
        agentRegistry
          .getAll()
          .find((a) => isAgentEnabled(enabledMap, a.id)) ??
        agentRegistry.getAll()[0]
      if (fallback) agentStore.setActiveAgent(fallback.id)
    }
    try {
      await ipc.setSettings({ customAgents: next })
    } catch (err) {
      reportError(err, { title: "Couldn't delete custom agent" })
    }
  },
}))
