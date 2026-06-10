import type { Edge, Node } from '@xyflow/react'
import { MarkerType } from '@xyflow/react'
import type {
  RelationEdge,
  RelationNode,
  RelationNodeKind,
} from '@/shared/types/relations'
import type { XY } from './layout'

/** Data carried by the custom `entity` node. */
export type EntityNodeData = { node: RelationNode; dimmed?: boolean }
export type EntityFlowNode = Node<EntityNodeData, 'entity'>

export interface RelationFilters {
  /** Node kinds currently shown. */
  kinds: Set<RelationNodeKind>
  /** Whether faint hub→component `owns` edges are drawn. */
  showOwns: boolean
  /** Whether low-confidence (heuristic) reference edges are drawn. */
  showHeuristic: boolean
}

export function toFlowNodes(
  nodes: RelationNode[],
  positions: Record<string, XY>,
  filters: RelationFilters,
  selectedId: string | null,
  /** Downstream-reachable set of the selection; others are dimmed. `null` = no highlight. */
  highlight: Set<string> | null,
): EntityFlowNode[] {
  return nodes
    .filter((n) => filters.kinds.has(n.kind))
    .map((n) => ({
      id: n.id,
      type: 'entity',
      position: positions[n.id] ?? { x: 0, y: 0 },
      selected: n.id === selectedId,
      data: { node: n, dimmed: highlight ? !highlight.has(n.id) : false },
    }))
}

export function toFlowEdges(
  edges: RelationEdge[],
  visibleNodeIds: Set<string>,
  filters: RelationFilters,
  /** Downstream-reachable set of the selection; in-chain edges glow, others dim. */
  highlight: Set<string> | null,
): Edge[] {
  return edges
    .filter((e) => {
      if (!visibleNodeIds.has(e.source) || !visibleNodeIds.has(e.target)) {
        return false
      }
      if (e.kind === 'owns') return filters.showOwns
      if (e.confidence === 'heuristic') return filters.showHeuristic
      return true
    })
    .map((e) => {
      const isOwns = e.kind === 'owns'
      const isHeuristic = e.confidence === 'heuristic'
      const base = isOwns
        ? 'rel-edge-owns'
        : isHeuristic
          ? 'rel-edge-heuristic'
          : 'rel-edge-structured'
      // When a chain is highlighted, reference edges fully inside it glow; the
      // rest fade back.
      const inChain =
        !isOwns && highlight
          ? highlight.has(e.source) && highlight.has(e.target)
          : false
      const className = !highlight
        ? base
        : inChain
          ? `${base} rel-edge-hot`
          : `${base} rel-edge-dim`
      return {
        id: e.id,
        source: e.source,
        target: e.target,
        // Orthogonal routing reads far cleaner than overlapping bezier curves
        // in a left-to-right hierarchy.
        type: 'smoothstep',
        className,
        // Faint ownership links don't need a direction arrow.
        markerEnd: isOwns
          ? undefined
          : {
              type: MarkerType.ArrowClosed,
              width: 16,
              height: 16,
              color: isHeuristic ? 'var(--border)' : 'var(--muted-foreground)',
            },
      }
    })
}
