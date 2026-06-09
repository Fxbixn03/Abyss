import type { RelationEdge } from '@/shared/types/relations'

/**
 * Remove cycle-closing back-edges so the directed graph becomes acyclic (a
 * depth-first search marking edges that point back into the active recursion
 * stack). Pure. The lane layout doesn't strictly need this — React Flow draws a
 * back-edge as an arc just fine — but writing it now (and testing it) makes a
 * later switch to a hierarchical layout (dagre/elk, which require a DAG) a
 * drop-in rather than a refactor. Subagent→subagent references make real cycles
 * (mutual spawning), so this is not hypothetical.
 *
 * Returns the input edges minus the back-edges; an already-acyclic graph is
 * returned unchanged (same edge objects).
 */
export function breakCycles(
  nodeIds: string[],
  edges: RelationEdge[],
): RelationEdge[] {
  const outgoing = new Map<string, RelationEdge[]>()
  for (const id of nodeIds) outgoing.set(id, [])
  for (const edge of edges) {
    const list = outgoing.get(edge.source)
    if (list) list.push(edge)
    else outgoing.set(edge.source, [edge])
  }

  // Tri-colour DFS: White = unvisited, Gray = on the active stack, Black = done.
  const WHITE = 0
  const GRAY = 1
  const BLACK = 2
  const color = new Map<string, number>()
  const backEdges = new Set<string>()

  const visit = (node: string): void => {
    color.set(node, GRAY)
    for (const edge of outgoing.get(node) ?? []) {
      const c = color.get(edge.target) ?? WHITE
      if (c === GRAY) backEdges.add(edge.id)
      else if (c === WHITE) visit(edge.target)
    }
    color.set(node, BLACK)
  }

  for (const id of nodeIds) {
    if ((color.get(id) ?? WHITE) === WHITE) visit(id)
  }

  return backEdges.size === 0 ? edges : edges.filter((e) => !backEdges.has(e.id))
}
