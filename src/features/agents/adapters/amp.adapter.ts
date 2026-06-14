import type { AgentAdapter } from '@/shared/types/agent'
import { ampDefinition } from '@/shared/agents/defs'
import { validateMarkdownInstructions } from '../lib/validators'
import { createAdapter } from './base.adapter'

/** Amp (Sourcegraph) — edits global instructions at `~/.amp/AGENTS.md`. */
export const ampAdapter: AgentAdapter = createAdapter(ampDefinition, {
  icon: 'zap',
  validate: validateMarkdownInstructions,
})
