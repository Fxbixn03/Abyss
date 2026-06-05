import type { AgentAdapter } from '@/shared/types/agent'
import { codexDefinition } from '@/shared/agents/defs'
import { validateMarkdownInstructions } from '../lib/validators'
import { createAdapter } from './base.adapter'

/** OpenAI Codex: AGENTS.md instruction files. */
export const codexAdapter: AgentAdapter = createAdapter(codexDefinition, {
  icon: 'terminal',
  validate: validateMarkdownInstructions,
})
