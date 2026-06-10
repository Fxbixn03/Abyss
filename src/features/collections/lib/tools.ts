/**
 * Known agent tool names and model suggestions for the subagent frontmatter
 * form. These power a picker (tools) and a datalist (model) so users avoid typos
 * — custom values stay allowed, since agents differ.
 */

/** Common Claude Code tool names a subagent can be scoped to. */
export const KNOWN_TOOLS: readonly string[] = [
  'Read',
  'Write',
  'Edit',
  'Bash',
  'Grep',
  'Glob',
  'Task',
  'WebFetch',
  'WebSearch',
  'TodoWrite',
  'NotebookEdit',
]

/** Suggested values for the `model` field (Claude); free text still allowed. */
export const MODEL_SUGGESTIONS: readonly string[] = [
  'sonnet',
  'opus',
  'haiku',
  'inherit',
]

/** Split a comma/space separated `tools` value into a clean list. */
export function parseToolList(tools: string | undefined): string[] {
  if (!tools) return []
  return tools
    .split(',')
    .map((t) => t.trim())
    .filter(Boolean)
}

/** Join a tool list back into the `tools` frontmatter value. */
export function joinToolList(tools: string[]): string {
  return tools.join(', ')
}
