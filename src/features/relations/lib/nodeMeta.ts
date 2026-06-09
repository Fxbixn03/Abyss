import type { RelationNodeKind } from '@/shared/types/relations'

/** lucide icon name per node kind. */
export const KIND_ICON: Record<RelationNodeKind, string> = {
  agent: 'sparkles',
  subagent: 'bot',
  command: 'square-slash',
  skill: 'graduation-cap',
  rule: 'book-open',
  hook: 'webhook',
  mcp: 'plug',
  instructions: 'file-text',
}

/** Short human label per node kind. */
export const KIND_LABEL: Record<RelationNodeKind, string> = {
  agent: 'Agent',
  subagent: 'Subagents',
  command: 'Commands',
  skill: 'Skills',
  rule: 'Rules',
  hook: 'Hooks',
  mcp: 'MCP',
  instructions: 'Instructions',
}

/** Icon-tile tint per kind — semantic tokens only (no hard-coded colors). */
export const KIND_TINT: Record<RelationNodeKind, string> = {
  agent: 'bg-primary/15 text-primary',
  subagent: 'bg-primary/10 text-primary',
  command: 'bg-accent text-accent-foreground',
  skill: 'bg-success/15 text-success',
  rule: 'bg-accent text-accent-foreground',
  hook: 'bg-muted text-muted-foreground',
  mcp: 'bg-warning/15 text-warning',
  instructions: 'bg-muted text-muted-foreground',
}
