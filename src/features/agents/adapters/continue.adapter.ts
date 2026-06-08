import type { AgentAdapter } from '@/shared/types/agent'
import { continueDefinition } from '@/shared/agents/defs'
import { createAdapter } from './base.adapter'

/** Continue — edits the global `config.yaml` under `~/.continue`. */
export const continueAdapter: AgentAdapter = createAdapter(continueDefinition, {
  icon: 'infinity',
})
