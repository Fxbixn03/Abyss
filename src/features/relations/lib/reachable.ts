import type { RelationEdge } from '@/shared/types/relations'

/**
 * The set of nodes reachable downstream from `start` by following directed
 * reference edges (`owns` links are ignored — they're the hub's containment, not
 * a runtime call). Includes `start` itself. Cycle-safe via a visited set. Pure.
 *
 * This is how the transitive runtime chain is shown: selecting `feature-request`
 * returns it plus `feature-orchestrator` and everything the orchestrator in turn
 * invokes — without drawing misleading direct edges the source file never had.
 */
export function reachableFrom(
  start: string,
  edges: RelationEdge[],
): Set<string> {
  const adjacency = new Map<string, string[]>()
  for (const e of edges) {
    if (e.kind === 'owns') continue
    const list = adjacency.get(e.source)
    if (list) list.push(e.target)
    else adjacency.set(e.source, [e.target])
  }

  const seen = new Set<string>([start])
  const stack = [start]
  while (stack.length > 0) {
    const current = stack.pop() as string
    for (const next of adjacency.get(current) ?? []) {
      if (!seen.has(next)) {
        seen.add(next)
        stack.push(next)
      }
    }
  }
  return seen
}

/**
 * `node` plus its direct neighbours in both directions (incoming and outgoing
 * reference edges, ignoring `owns`). Used to spotlight a node's immediate
 * relations on hover. Pure.
 */
export function neighbors(node: string, edges: RelationEdge[]): Set<string> {
  const set = new Set<string>([node])
  for (const e of edges) {
    if (e.kind === 'owns') continue
    if (e.source === node) set.add(e.target)
    else if (e.target === node) set.add(e.source)
  }
  return set
}
