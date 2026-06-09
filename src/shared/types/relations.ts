/**
 * Pure types for the Relations map: a node-graph of one agent's configurable
 * components (subagents, commands, skills, rules, hooks, MCP servers, the main
 * instruction file) plus a central agent hub, with edges that describe how they
 * reference each other.
 *
 * No Node, no React — safe to import from the renderer, main process and CLI.
 */

import type { CollectionKind } from './collections'

export type RelationNodeKind =
  | 'agent' // the AI agent itself — the central hub
  | 'subagent'
  | 'command'
  | 'skill'
  | 'rule'
  | 'hook'
  | 'mcp'
  | 'instructions'

export type RelationEdgeKind =
  | 'owns' // hub → component (faint, toggleable)
  | 'invokes-agent'
  | 'invokes-command'
  | 'uses-skill'
  | 'uses-mcp'

/** How sure we are about an edge — drives styling and default visibility. */
export type RelationConfidence = 'structured' | 'heuristic'

export interface RelationNode {
  /** Graph-unique id: `${kind}:${itemId}`. */
  id: string
  kind: RelationNodeKind
  /** Display name. */
  label: string
  /** Short subtitle (frontmatter description, hook command, MCP target). */
  description?: string
  /** CollectionItem.id / hook.id / MCP server name / 'instructions'. */
  itemId: string
  /** Set for subagent/command/skill/rule — enables inline `.md` editing. */
  collectionKind?: CollectionKind
  /** Absolute file path, when the node maps to a file on disk. */
  filePath?: string
  /** Whether this node's `.md` can be edited inline in the inspector. */
  editable: boolean
}

export interface RelationEdge {
  id: string
  source: string
  target: string
  kind: RelationEdgeKind
  confidence: RelationConfidence
}

export interface RelationGraph {
  nodes: RelationNode[]
  edges: RelationEdge[]
  /** Sources that could not be read (path + reason); drives conservative pruning. */
  warnings: string[]
}
