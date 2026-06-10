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
/** Vertical gap between the connected graph and the isolated-node grid. */
const GRID_GAP = 140
const GRID_COLS = 5
const GRID_CELL_W = 250
const GRID_CELL_H = 84
const ORIGIN = 24

/**
 * Layout for the relations graph.
 *
 * **Connected** nodes (those touched by a reference edge) are laid out by dagre
 * as a left-to-right hierarchy with crossing minimisation. **Isolated** nodes
 * (no reference edges — standalone commands, hooks, unused skills/MCP) would
 * otherwise be dumped into dagre's first rank and swamp the left edge, so they
 * are instead arranged in a compact grid below the hierarchy. The agent hub sits
 * to the left of the hierarchy, vertically centred.
 *
 * Only reference edges drive the hierarchy; `owns` edges are excluded (they'd
 * collapse everything onto one rank). The graph is made acyclic first via
 * {@link breakCycles}, since dagre requires a DAG.
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
  const connectedIds = new Set<string>()
  for (const e of refEdges) {
    connectedIds.add(e.source)
    connectedIds.add(e.target)
  }
  const connected = rest.filter((n) => connectedIds.has(n.id))
  const isolated = rest.filter((n) => !connectedIds.has(n.id))

  const positions: Record<string, XY> = {}

  // --- connected nodes → dagre hierarchy ---
  let minX = ORIGIN + HUB_GAP // so the hub lands near ORIGIN when nothing connects
  let minY = ORIGIN
  let maxY = ORIGIN
  if (connected.length > 0) {
    const acyclic = breakCycles(
      connected.map((n) => n.id),
      refEdges,
    )
    const g = new Graph({ directed: true })
    g.setGraph({ rankdir: 'LR', nodesep: 24, ranksep: 96, marginx: ORIGIN, marginy: ORIGIN })
    g.setDefaultEdgeLabel(() => ({}))
    for (const n of connected) {
      g.setNode(n.id, { width: NODE_WIDTH, height: NODE_HEIGHT })
    }
    for (const e of acyclic) g.setEdge(e.source, e.target)
    dagreLayout(g)

    minX = Infinity
    minY = Infinity
    maxY = -Infinity
    for (const n of connected) {
      const p = g.node(n.id)
      if (!p || p.x === undefined || p.y === undefined) continue
      // dagre reports node centres; React Flow positions are top-left.
      const x = p.x - NODE_WIDTH / 2
      const y = p.y - NODE_HEIGHT / 2
      positions[n.id] = { x, y }
      minX = Math.min(minX, x)
      minY = Math.min(minY, y)
      maxY = Math.max(maxY, y + NODE_HEIGHT)
    }
    if (!Number.isFinite(minX)) {
      minX = ORIGIN + HUB_GAP
      minY = ORIGIN
      maxY = ORIGIN
    }
  }

  // --- isolated nodes → compact grid below the hierarchy ---
  const gridY = connected.length > 0 ? maxY + GRID_GAP : ORIGIN
  isolated.forEach((n, i) => {
    const col = i % GRID_COLS
    const row = Math.floor(i / GRID_COLS)
    positions[n.id] = {
      x: minX + col * GRID_CELL_W,
      y: gridY + row * GRID_CELL_H,
    }
  })

  // --- hub: left of the hierarchy, vertically centred ---
  if (hub) {
    positions[hub.id] = { x: minX - HUB_GAP, y: (minY + maxY) / 2 }
  }

  return positions
}
