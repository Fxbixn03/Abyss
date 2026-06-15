import type { AgentAdapter } from '@/shared/types/agent'
import { warpDefinition } from '@/shared/agents/defs'
import { validateMarkdownInstructions } from '../lib/validators'
import { createAdapter } from './base.adapter'

/** Warp terminal AI — edits the global agent instructions under `~/.warp/agents/`. */
export const warpAdapter: AgentAdapter = createAdapter(warpDefinition, {
  icon: 'terminal',
  validate: validateMarkdownInstructions,
})
