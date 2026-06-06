export interface PromptTemplate {
  id: string
  title: string
  description: string
  tags: string[]
  /** The rules / system-prompt body inserted into instructions. */
  content: string
  /** True for the curated built-ins. */
  builtin?: boolean
}
