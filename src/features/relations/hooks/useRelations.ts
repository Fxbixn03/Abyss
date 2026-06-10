import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { IpcEvent } from '@/shared/types/ipc'
import { ipc } from '@/shared/ipc/ipc.client'
import type {
  RelationGraph,
  RelationNode,
  RelationNodeKind,
} from '@/shared/types/relations'
import { ACTIVE_AGENT_IDS } from '@/shared/agents/defs'
import { useActiveAgentId } from '@/features/agents/hooks/useActiveAgent'
import { useConfigBase, useScope } from '@/features/scope/hooks/useScopedBase'
import { autoLayout, type XY } from '../lib/layout'
import { neighbors, reachableFrom } from '../lib/reachable'
import {
  toFlowEdges,
  toFlowNodes,
  type RelationFilters,
} from '../lib/toFlow'
import { layoutKey, useRelationsLayout } from '../store/relationsLayout.store'

/** Every node kind — the default-visible set. */
export const ALL_NODE_KINDS: RelationNodeKind[] = [
  'agent',
  'subagent',
  'command',
  'skill',
  'rule',
  'hook',
  'mcp',
  'instructions',
]

const REBUILD_DEBOUNCE_MS = 300

export function useRelations() {
  const agentId = useActiveAgentId()
  const basePath = useConfigBase(agentId)
  const { scope, projectDir } = useScope()
  const ipcProjectDir = scope === 'project' ? (projectDir ?? undefined) : undefined
  const key = layoutKey(agentId, scope, projectDir)

  const [graph, setGraph] = useState<RelationGraph | null>(null)
  const [loading, setLoading] = useState(false)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [hoveredId, setHoveredId] = useState<string | null>(null)
  // Ownership (hub → component) links are off by default: they connect the hub
  // to everything and quickly swamp the meaningful reference edges. The
  // dependency layout and reference edges are the signal; toggle this for the
  // "what belongs to this agent" overview.
  const [showOwns, setShowOwns] = useState(false)
  // On by default: in real setups most links between commands/subagents/skills
  // are name mentions (heuristic), so hiding them leaves the graph near-empty.
  // Distinctive kebab ids keep false positives low; toggle off to declutter.
  const [showHeuristic, setShowHeuristic] = useState(true)
  const [hiddenKinds, setHiddenKinds] = useState<Set<RelationNodeKind>>(
    () => new Set(),
  )

  const storedPositions = useRelationsLayout((s) => s.positions[key])
  const setPosition = useRelationsLayout((s) => s.setPosition)
  const resetLayout = useRelationsLayout((s) => s.resetLayout)
  const pruneLayout = useRelationsLayout((s) => s.prune)

  // One-time quota GC: drop positions for agents that no longer exist.
  useEffect(() => {
    useRelationsLayout.getState().gcAgents(ACTIVE_AGENT_IDS)
  }, [])

  // Prune stored positions only when the read fully succeeded — a partial read
  // (warnings) must keep positions, so a transient error never drops a node's
  // place on disk.
  const pruneIfClean = useCallback(
    (g: RelationGraph) => {
      if (g.warnings.length === 0) {
        pruneLayout(
          key,
          g.nodes.map((n) => n.id),
        )
      }
    },
    [key, pruneLayout],
  )

  // Reusable loader for the file watch and the Refresh button (event-handler
  // contexts, so synchronous setState is fine here).
  const refresh = useCallback(async () => {
    if (!basePath) return
    setLoading(true)
    try {
      const g = await ipc.buildRelationGraph(agentId, basePath, ipcProjectDir)
      setGraph(g)
      pruneIfClean(g)
    } finally {
      setLoading(false)
    }
  }, [agentId, basePath, ipcProjectDir, pruneIfClean])

  // Initial / dependency-driven load. Inlined with setState in the async
  // callback so it never sets state synchronously inside the effect. When
  // there's no base path the page shows an empty state, so a stale graph is
  // never rendered — no need to clear it here.
  useEffect(() => {
    if (!basePath) return
    let active = true
    void ipc.buildRelationGraph(agentId, basePath, ipcProjectDir).then((g) => {
      if (!active) return
      setGraph(g)
      pruneIfClean(g)
    })
    return () => {
      active = false
    }
  }, [agentId, basePath, ipcProjectDir, pruneIfClean])

  // Watch the on-disk files behind the current nodes; rebuild (debounced) when
  // any of them changes — externally or from our own inspector save.
  const watchKey = useMemo(
    () =>
      (graph?.nodes ?? [])
        .map((n) => n.filePath)
        .filter((p): p is string => Boolean(p))
        .join('\n'),
    [graph],
  )
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  useEffect(() => {
    if (!watchKey) return
    const paths = watchKey.split('\n')
    const watched = new Set(paths)
    for (const p of paths) void ipc.fsWatch(p)
    const unsubscribe = ipc.subscribe(IpcEvent.FileChanged, ({ path }) => {
      if (!watched.has(path)) return
      if (timer.current) clearTimeout(timer.current)
      timer.current = setTimeout(() => void refresh(), REBUILD_DEBOUNCE_MS)
    })
    return () => {
      if (timer.current) clearTimeout(timer.current)
      unsubscribe()
      for (const p of paths) void ipc.fsUnwatch(p)
    }
  }, [watchKey, refresh])

  const filters: RelationFilters = useMemo(
    () => ({
      kinds: new Set(
        ALL_NODE_KINDS.filter((k) => !hiddenKinds.has(k)),
      ),
      showOwns,
      showHeuristic,
    }),
    [hiddenKinds, showOwns, showHeuristic],
  )

  // Effective positions: stored override auto-layout; new nodes (no stored
  // position) fall back to auto-layout — the mixed-set case.
  const positions = useMemo<Record<string, XY>>(() => {
    if (!graph) return {}
    return { ...autoLayout(graph.nodes, graph.edges), ...(storedPositions ?? {}) }
  }, [graph, storedPositions])

  // What to spotlight: hovering a node shows its direct neighbours (quick "what
  // touches this?"), while selecting shows the full transitive downstream chain.
  // Hover takes precedence so you can probe without losing your selection.
  const highlight = useMemo(() => {
    if (!graph) return null
    if (hoveredId) return neighbors(hoveredId, graph.edges)
    if (selectedId) return reachableFrom(selectedId, graph.edges)
    return null
  }, [graph, hoveredId, selectedId])

  const flowNodes = useMemo(
    () =>
      graph
        ? toFlowNodes(graph.nodes, positions, filters, selectedId, highlight)
        : [],
    [graph, positions, filters, selectedId, highlight],
  )
  const flowEdges = useMemo(() => {
    if (!graph) return []
    const visible = new Set(flowNodes.map((n) => n.id))
    return toFlowEdges(graph.edges, visible, filters, highlight)
  }, [graph, flowNodes, filters, highlight])

  const selectedNode: RelationNode | null = useMemo(
    () => graph?.nodes.find((n) => n.id === selectedId) ?? null,
    [graph, selectedId],
  )

  const toggleKind = useCallback((kind: RelationNodeKind) => {
    setHiddenKinds((prev) => {
      const next = new Set(prev)
      if (next.has(kind)) next.delete(kind)
      else next.add(kind)
      return next
    })
  }, [])

  const onDragStop = useCallback(
    (id: string, xy: XY) => setPosition(key, id, xy),
    [key, setPosition],
  )

  const reLayout = useCallback(() => resetLayout(key), [key, resetLayout])

  return {
    agentId,
    basePath,
    graph,
    loading,
    flowNodes,
    flowEdges,
    filters,
    hiddenKinds,
    toggleKind,
    showOwns,
    setShowOwns,
    showHeuristic,
    setShowHeuristic,
    selectedId,
    setSelectedId,
    setHoveredId,
    selectedNode,
    onDragStop,
    reLayout,
    refresh,
  }
}

export type RelationsController = ReturnType<typeof useRelations>
