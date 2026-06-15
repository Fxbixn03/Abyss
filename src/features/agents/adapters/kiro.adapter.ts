import type { AgentAdapter } from '@/shared/types/agent'
import { kiroDefinition } from '@/shared/agents/defs'
import { validateMarkdownInstructions } from '../lib/validators'
import { createAdapter } from './base.adapter'

/** Kiro (AWS) — edits the global steering file under `~/.kiro/steering/`. */
export const kiroAdapter: AgentAdapter = createAdapter(kiroDefinition, {
  icon: 'cloud',
  validate: validateMarkdownInstructions,
})
