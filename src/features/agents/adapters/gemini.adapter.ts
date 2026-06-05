import type { AgentAdapter } from '@/shared/types/agent'
import { geminiDefinition } from '@/shared/agents/defs'
import { validateMarkdownInstructions } from '../lib/validators'
import { createAdapter } from './base.adapter'

/**
 * Gemini CLI — the worked example for "how to add an agent". This file is
 * complete; to enable Gemini in the app, uncomment its registration in
 * `registry/agent.registry.ts` and add 'gemini' to ACTIVE_AGENT_IDS in
 * `shared/agents/defs.ts`. Nothing else changes.
 */
export const geminiAdapter: AgentAdapter = createAdapter(geminiDefinition, {
  icon: 'gem',
  validate: validateMarkdownInstructions,
})
