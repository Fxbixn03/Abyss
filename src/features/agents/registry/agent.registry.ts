import type { AgentAdapter, AgentId } from '@/shared/types/agent'
import { claudeAdapter } from '../adapters/claude.adapter'
import { codexAdapter } from '../adapters/codex.adapter'
// import { geminiAdapter } from '../adapters/gemini.adapter'

/**
 * Central registry of agent adapters. The single place the app discovers which
 * agents exist. Adding an agent = register one line here (plus its adapter file
 * and theme preset).
 */
class AgentRegistry {
  private readonly adapters = new Map<AgentId, AgentAdapter>()

  register(adapter: AgentAdapter): void {
    this.adapters.set(adapter.id, adapter)
  }

  get(id: AgentId): AgentAdapter {
    const adapter = this.adapters.get(id)
    if (!adapter) throw new Error(`No adapter registered for agent: ${id}`)
    return adapter
  }

  getAll(): AgentAdapter[] {
    return [...this.adapters.values()]
  }

  has(id: AgentId): boolean {
    return this.adapters.has(id)
  }
}

export const agentRegistry = new AgentRegistry()

// --- Built-in agents (v1) ---------------------------------------------------
agentRegistry.register(claudeAdapter)
agentRegistry.register(codexAdapter)
// agentRegistry.register(geminiAdapter) // ← uncomment to enable Gemini CLI
