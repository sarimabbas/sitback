import {
  Background,
  Controls,
  MiniMap,
  type ReactFlowInstance,
  type Node,
  type NodeMouseHandler,
  type NodeTypes,
  ReactFlow,
  useEdgesState,
  useNodesState,
} from '@xyflow/react'
import { useEffect, useMemo, useRef } from 'react'

import { buildTagPathMap } from '../lib/filtering'
import { toReactFlowGraph } from '../lib/graph-mapper'
import { TodoGraphGroupNode } from './todo-graph-group-node'
import { TodoGraphNode } from './todo-graph-node'
import type {
  DashboardDependency,
  DashboardTagNode,
  DashboardTodo,
} from '../types'

import '@xyflow/react/dist/style.css'

type TodoGraphViewProps = {
  todos: DashboardTodo[]
  dependencies: DashboardDependency[]
  tagTree: DashboardTagNode[]
  selectedTagPath: string | null
  onSelectTodo: (todoId: number) => void
}

export function TodoGraphView({
  todos,
  dependencies,
  tagTree,
  selectedTagPath,
  onSelectTodo,
}: TodoGraphViewProps) {
  const reactFlowRef = useRef<ReactFlowInstance<Node> | null>(null)

  const miniMapNodeColor = (node: Node) => {
    if (node.type === 'groupBox') {
      return 'transparent'
    }

    const laneType = (node.data as { laneType?: string } | undefined)?.laneType
    if (laneType === 'same_tag') {
      return '#38bdf8'
    }
    if (laneType === 'untagged') {
      return '#f59e0b'
    }

    return '#64748b'
  }

  const nodeTypes = useMemo<NodeTypes>(
    () => ({
      todoCard: TodoGraphNode,
      groupBox: TodoGraphGroupNode,
    }),
    [],
  )

  const tagPathMap = useMemo(() => buildTagPathMap(tagTree), [tagTree])

  const graph = useMemo(
    () => toReactFlowGraph(todos, dependencies, tagPathMap, selectedTagPath),
    [todos, dependencies, tagPathMap, selectedTagPath],
  )

  const graphWithHandlers = useMemo(() => {
    return {
      edges: graph.edges,
      nodes: graph.nodes.map((node) => {
        if (node.type !== 'todoCard') {
          return node
        }

        return {
          ...node,
          data: {
            ...(node.data as Record<string, unknown>),
            onJumpToTodo: (todoId: number) => {
              if (!reactFlowRef.current) {
                return
              }

              void reactFlowRef.current.fitView({
                nodes: [{ id: String(todoId) }],
                padding: 0.3,
                duration: 260,
              })
            },
          },
        }
      }),
    }
  }, [graph])

  const [nodes, setNodes, onNodesChange] = useNodesState<Node>(graphWithHandlers.nodes)
  const [edges, setEdges, onEdgesChange] = useEdgesState(graphWithHandlers.edges)

  useEffect(() => {
    setNodes(graphWithHandlers.nodes)
    setEdges(graphWithHandlers.edges)
  }, [graphWithHandlers, setNodes, setEdges])

  useEffect(() => {
    if (!reactFlowRef.current || graph.nodes.length === 0) {
      return
    }

    requestAnimationFrame(() => {
      void reactFlowRef.current?.fitView({
        padding: 0.2,
        duration: 280,
      })
    })
  }, [graph.nodes.length])

  const handleNodeClick: NodeMouseHandler = (_event, node) => {
    onSelectTodo(Number(node.id))
  }

  if (todos.length === 0) {
    return (
      <section className="flex h-full min-h-[420px] items-center justify-center rounded-xl border border-slate-200 bg-white shadow-sm sm:min-h-[520px]">
        <p className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">
          No todos match the current filters.
        </p>
      </section>
    )
  }

  return (
    <section className="h-full min-h-[420px] overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm sm:min-h-[520px]">
      <ReactFlow
        key={selectedTagPath ?? 'all-tags'}
        fitView
        edges={edges}
        nodes={nodes}
        nodeTypes={nodeTypes}
        nodesConnectable={false}
        nodesDraggable={false}
        elementsSelectable
        onNodeClick={handleNodeClick}
        onEdgesChange={onEdgesChange}
        onNodesChange={onNodesChange}
        onInit={(instance) => {
          reactFlowRef.current = instance
        }}
      >
        <MiniMap
          pannable
          zoomable
          nodeClassName={(node) => (node.type === 'groupBox' ? 'hidden' : '')}
          nodeColor={miniMapNodeColor}
          nodeStrokeColor="#0f172a"
          nodeStrokeWidth={1.5}
          maskColor="rgba(15, 23, 42, 0.08)"
          style={{ backgroundColor: 'rgba(248, 250, 252, 0.95)' }}
        />
        <Controls showInteractive={false} />
        <Background gap={20} size={1} />
      </ReactFlow>
    </section>
  )
}
