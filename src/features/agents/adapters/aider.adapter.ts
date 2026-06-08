import type { AgentAdapter } from '@/shared/types/agent'
import { aiderDefinition } from '@/shared/agents/defs'
import { createAdapter } from './base.adapter'

/** Aider — edits the YAML config at `~/.aider.conf.yml`. */
export const aiderAdapter: AgentAdapter = createAdapter(aiderDefinition, {
  icon: 'terminal',
})
