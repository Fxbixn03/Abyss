import type { AgentAdapter } from '@/shared/types/agent'
import { gooseDefinition } from '@/shared/agents/defs'
import { createAdapter } from './base.adapter'

/** Goose (Block) — edits the global `config.yaml` under `~/.config/goose`. */
export const gooseAdapter: AgentAdapter = createAdapter(gooseDefinition, {
  icon: 'bird',
})
