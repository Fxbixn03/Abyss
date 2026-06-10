import '@xyflow/react/dist/style.css'
import { useEffect } from 'react'
import {
  Background,
  Controls,
  MiniMap,
  ReactFlow,
  useEdgesState,
  useNodesState,
  type Edge,
  type NodeMouseHandler,
  type NodeTypes,
  type OnNodeDrag,
} from '@xyflow/react'
import { EntityNode } from './EntityNode'
import type { XY } from '../lib/layout'
import type { EntityFlowNode } from '../lib/toFlow'

const nodeTypes: NodeTypes = { entity: EntityNode }

/**
 * The React Flow surface. Nodes/edges are derived upstream (from the graph +
 * stored positions + filters); we mirror them into React Flow's local state so
 * dragging is smooth, and report the final position back on drag stop.
 */
export function RelationsCanvas({
  nodes,
  edges,
  onSelect,
  onHover,
  onDragStop,
}: {
  nodes: EntityFlowNode[]
  edges: Edge[]
  onSelect: (id: string | null) => void
  onHover: (id: string | null) => void
  onDragStop: (id: string, xy: XY) => void
}) {
  const [rfNodes, setRfNodes, onNodesChange] = useNodesState<EntityFlowNode>(nodes)
  const [rfEdges, setRfEdges, onEdgesChange] = useEdgesState(edges)

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
