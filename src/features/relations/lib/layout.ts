import { Graph, layout as dagreLayout } from '@dagrejs/dagre'
import type { RelationEdge, RelationNode } from '@/shared/types/relations'
import { breakCycles } from './breakCycles'

export interface XY {
  x: number
  y: number
}

const NODE_WIDTH = 224
const NODE_HEIGHT = 58
/** Horizontal gap between the hub and the left-most laid-out rank. */
const HUB_GAP = 320

/**
 * Hierarchical left-to-right layout (dagre): ranks nodes by their reference
 * dependencies and orders within ranks to minimise edge crossings — far cleaner
 * than fixed lanes once a setup has many subagents/skills.
 *
 * Only *reference* edges (`invokes-*` / `uses-*`) drive the hierarchy; the
 * hub's `owns` edges are excluded (they'd collapse every component onto a single
 * rank right under the hub). The graph is made acyclic first via {@link
 * breakCycles}, since dagre requires a DAG. The hub itself is placed to the left
 * of the first rank, vertically centred.
 *
 * Pure. Signature `(nodes, edges) => Record<id, XY>`.
 */
export function autoLayout(
  nodes: RelationNode[],
  edges: RelationEdge[],
): Record<string, XY> {
  const hub = nodes.find((n) => n.kind === 'agent')
  const rest = nodes.filter((n) => n.kind !== 'agent')
  const ids = new Set(rest.map((n) => n.id))

  const refEdges = edges.filter(
    (e) => e.kind !== 'owns' && ids.has(e.source) && ids.has(e.target),
  )
  const acyclic = breakCycles(
    rest.map((n) => n.id),
    refEdges,
  )

  const g = new Graph({ directed: true })
  g.setGraph({ rankdir: 'LR', nodesep: 22, ranksep: 90, marginx: 24, marginy: 24 })
  g.setDefaultEdgeLabel(() => ({}))
  for (const n of rest) g.setNode(n.id, { width: NODE_WIDTH, height: NODE_HEIGHT })
  for (const e of acyclic) g.setEdge(e.source, e.target)
  dagreLayout(g)

  const positions: Record<string, XY> = {}
  let minX = Infinity
  let minY = Infinity
  let maxY = -Infinity
  for (const n of rest) {
    const p = g.node(n.id)
    if (!p || p.x === undefined || p.y === undefined) continue
    // dagre reports node centres; React Flow positions are top-left.
    const x = p.x - NODE_WIDTH / 2
    const y = p.y - NODE_HEIGHT / 2
    positions[n.id] = { x, y }
    minX = Math.min(minX, x)
    minY = Math.min(minY, y)
    maxY = Math.max(maxY, y)
  }

  if (hub) {
    positions[hub.id] = Number.isFinite(minX)
      ? { x: minX - HUB_GAP, y: (minY + maxY) / 2 }
      : { x: 24, y: 24 }
  }
  return positions
}
