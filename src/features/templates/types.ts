import type { AgentId } from '@/shared/types/agent'

export interface PromptTemplate {
  id: string
  title: string
  description: string
  tags: string[]
  /** The rules / system-prompt body inserted into instructions. */
  content: string
  /**
   * Agents this template is written for. Empty/undefined means "any agent" —
   * the apply dialog pre-selects these when present.
   */
  agentIds?: AgentId[]
  /** True for the curated built-ins. */
  builtin?: boolean
}

/** Per-template usage record, used to surface recently/often-used templates. */
export interface TemplateUsage {
  count: number
  /** Epoch millis of the last apply/copy. */
  at: number
}
