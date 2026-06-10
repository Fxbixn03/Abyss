import { useEffect, useState } from 'react'
import type {
  RelationGraph,
  RelationNode,
  RelationNodeKind,
} from '@/shared/types/relations'
import { Icon } from '@/shared/components/Icon'
import { cn } from '@/shared/lib/utils'
import { ipc } from '@/shared/ipc/ipc.client'

const KIND_ICON: Record<RelationNodeKind, string> = {
  agent: 'bot',
  subagent: 'bot',
  command: 'square-slash',
  skill: 'graduation-cap',
  rule: 'book-open',
  hook: 'webhook',
  mcp: 'plug',
  instructions: 'file-text',
}

function Chips({ nodes }: { nodes: { node: RelationNode; guess: boolean }[] }) {
  if (nodes.length === 0)
    return <span className="text-xs text-muted-foreground">—</span>
  return (
    <div className="flex flex-wrap gap-1">
      {nodes.map(({ node, guess }) => (
        <span
          key={node.id}
          title={guess ? 'Heuristic match' : 'Detected reference'}
          className={cn(
            'flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs',
            guess
              ? 'border-dashed border-border text-muted-foreground'
              : 'border-border',
          )}
        >
          <Icon name={KIND_ICON[node.kind]} className="size-3 shrink-0" />
          <span className="truncate">{node.label}</span>
        </span>
      ))}
    </div>
  )
}

/**
 * Compact "Uses / Used by" view for one collection item (subagent or command),
 * built from the relation graph (what it references, and what references it).
 */
export function CollectionRelations({
  agentId,
  basePath,
  projectDir,
  nodeKind,
  itemId,
}: {
  agentId: string
  basePath: string
  projectDir?: string
  nodeKind: RelationNodeKind
  itemId: string
}) {
  const [graph, setGraph] = useState<RelationGraph | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    // setState only inside callbacks (microtask + promise), never synchronously
    // in the effect body — keeps react-hooks/set-state-in-effect happy.
    void Promise.resolve().then(() => {
      if (active) setLoading(true)
    })
    ipc
      .buildRelationGraph(agentId, basePath, projectDir)
      .then((g) => {
        if (active) {
          setGraph(g)
          setLoading(false)
        }
      })
      .catch(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [agentId, basePath, projectDir])

  const nodeId = `${nodeKind}:${itemId}`
  const byId = new Map((graph?.nodes ?? []).map((n) => [n.id, n]))
  const edges = (graph?.edges ?? []).filter((e) => e.kind !== 'owns')

  const resolve = (ids: { id: string; guess: boolean }[]) =>
    ids
      .map(({ id, guess }) => {
        const node = byId.get(id)
        return node ? { node, guess } : null
      })
      .filter((x): x is { node: RelationNode; guess: boolean } => x !== null)

  const uses = resolve(
    edges
      .filter((e) => e.source === nodeId)
      .map((e) => ({ id: e.target, guess: e.confidence === 'heuristic' })),
  )
  const usedBy = resolve(
    edges
      .filter((e) => e.target === nodeId)
      .map((e) => ({ id: e.source, guess: e.confidence === 'heuristic' })),
  )

  return (
    <div className="rounded-md border border-border bg-card/40 p-3">
      {loading ? (
        <p className="text-xs text-muted-foreground">Loading relations…</p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <span className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
              <Icon name="arrow-right" className="size-3.5" />
              Uses
            </span>
            <Chips nodes={uses} />
          </div>
          <div className="space-y-1.5">
            <span className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
              <Icon name="arrow-left" className="size-3.5" />
              Used by
            </span>
            <Chips nodes={usedBy} />
          </div>
        </div>
      )}
    </div>
  )
}
