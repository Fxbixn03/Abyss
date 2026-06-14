import '@xyflow/react/dist/style.css'
import { useCallback, useEffect } from 'react'
import {
  Background,
  Controls,
  getNodesBounds,
  MiniMap,
  ReactFlow,
  ReactFlowProvider,
  useEdgesState,
  useNodesState,
  useReactFlow,
  type Edge,
  type NodeMouseHandler,
  type NodeTypes,
  type OnNodeDrag,
} from '@xyflow/react'
import { EntityNode } from './EntityNode'
import type { XY } from '../lib/layout'
import type { EntityFlowNode } from '../lib/toFlow'
import { exportFlowToPng } from '../lib/exportPng'

const nodeTypes: NodeTypes = { entity: EntityNode }

type RegisterExporter = (fn: (() => Promise<void>) | null) => void

/**
 * The React Flow surface. Nodes/edges are derived upstream (from the graph +
 * stored positions + filters); we mirror them into React Flow's local state so
 * dragging is smooth, and report the final position back on drag stop.
 *
 * Wrapped in a `ReactFlowProvider` so the inner surface can read measured node
 * dimensions (for the PNG export) via `useReactFlow`.
 */
export function RelationsCanvas(props: {
  nodes: EntityFlowNode[]
  edges: Edge[]
  agentId: string
  onSelect: (id: string | null) => void
  onHover: (id: string | null) => void
  onDragStop: (id: string, xy: XY) => void
  registerExporter: RegisterExporter
}) {
  return (
    <ReactFlowProvider>
      <RelationsCanvasInner {...props} />
    </ReactFlowProvider>
  )
}

function RelationsCanvasInner({
  nodes,
  edges,
  agentId,
  onSelect,
  onHover,
  onDragStop,
  registerExporter,
}: {
  nodes: EntityFlowNode[]
  edges: Edge[]
  agentId: string
  onSelect: (id: string | null) => void
  onHover: (id: string | null) => void
  onDragStop: (id: string, xy: XY) => void
  registerExporter: RegisterExporter
}) {
  const [rfNodes, setRfNodes, onNodesChange] =
    useNodesState<EntityFlowNode>(nodes)
  const [rfEdges, setRfEdges, onEdgesChange] = useEdgesState(edges)
  const { getNodes } = useReactFlow<EntityFlowNode>()

  useEffect(() => {
    setRfNodes(nodes)
  }, [nodes, setRfNodes])
  useEffect(() => {
    setRfEdges(edges)
  }, [edges, setRfEdges])

  const handleNodeClick: NodeMouseHandler<EntityFlowNode> = (_e, node) =>
    onSelect(node.id)
  const handleNodeEnter: NodeMouseHandler<EntityFlowNode> = (_e, node) =>
    onHover(node.id)
  const handleNodeLeave: NodeMouseHandler<EntityFlowNode> = () => onHover(null)
  const handleDragStop: OnNodeDrag<EntityFlowNode> = (_e, node) =>
    onDragStop(node.id, node.position)

  // Rasterise the current graph to a PNG download. Lives here because it needs
  // the measured node dimensions (`getNodes`) and the rendered `.react-flow`
  // DOM, both of which are only available on the canvas side.
  const exportPng = useCallback(async () => {
    const measured = getNodes()
    if (measured.length === 0) return
    const bounds = getNodesBounds(measured)
    await exportFlowToPng({ bounds, agentId })
  }, [getNodes, agentId])

  useEffect(() => {
    registerExporter(exportPng)
    return () => registerExporter(null)
  }, [registerExporter, exportPng])

  return (
    <div className="h-full w-full overflow-hidden rounded-lg border border-border bg-card/30">
      <ReactFlow
        nodes={rfNodes}
        edges={rfEdges}
        nodeTypes={nodeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={handleNodeClick}
        onNodeMouseEnter={handleNodeEnter}
        onNodeMouseLeave={handleNodeLeave}
        onNodeDragStop={handleDragStop}
        onPaneClick={() => onSelect(null)}
        nodesConnectable={false}
        edgesFocusable={false}
        proOptions={{ hideAttribution: true }}
        minZoom={0.2}
        fitView
      >
        <Background color="var(--border)" gap={22} />
        <Controls showInteractive={false} />
        <MiniMap
          pannable
          zoomable
          nodeColor="var(--muted-foreground)"
          maskColor="color-mix(in srgb, var(--background) 70%, transparent)"
        />
      </ReactFlow>
    </div>
  )
}
