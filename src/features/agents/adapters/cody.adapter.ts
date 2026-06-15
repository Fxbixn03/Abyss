import type { AgentAdapter } from '@/shared/types/agent'
import { codyDefinition } from '@/shared/agents/defs'
import { createAdapter } from './base.adapter'

/** Sourcegraph Cody CLI — edits config.json with customInstructions field. */
export const codyAdapter: AgentAdapter = createAdapter(codyDefinition, {
  icon: 'search-code',
})
