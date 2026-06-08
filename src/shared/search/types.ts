/**
 * Shared types for the global config search (Command palette → search across
 * every agent's hooks, MCP servers, permissions and collection items).
 */

export type GlobalSearchKind =
  | 'mcp'
  | 'hook'
  | 'permission'
  | 'skill'
  | 'command'
  | 'subagent'
  | 'rule'

export interface GlobalSearchResult {
  /** The agent this config item belongs to. */
  agentId: string
  kind: GlobalSearchKind
  /** Primary label shown in the palette. */
  label: string
  /** Secondary text (command, url, rule scope, description …). */
  detail: string
  /** Renderer route to open when the result is picked. */
  route: string
}
