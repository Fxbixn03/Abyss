import type { AgentAdapter } from '@/shared/types/agent'
import { rooDefinition } from '@/shared/agents/defs'
import { validateMarkdownInstructions } from '../lib/validators'
import { createAdapter } from './base.adapter'

/** Roo Code — edits a global rules file under `~/.roo/rules/`. */
export const rooAdapter: AgentAdapter = createAdapter(rooDefinition, {
  icon: 'img:roo',
  validate: validateMarkdownInstructions,
})
