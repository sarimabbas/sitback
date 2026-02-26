import {
  type Edge,
  MarkerType,
  type Node,
  Position,
} from '@xyflow/react'

import type { DashboardDependency, DashboardTodo } from '../types'

function computeLevels(
  todos: DashboardTodo[],
  dependencies: DashboardDependency[],
): Map<number, number> {
  const ids = new Set(todos.map((todo) => todo.id))
  const outgoing = new Map<number, number[]>()
  const indegree = new Map<number, number>()
  const levelById = new Map<number, number>()

  for (const todo of todos) {
    outgoing.set(todo.id, [])
    indegree.set(todo.id, 0)
    levelById.set(todo.id, 0)
  }

  for (const dependency of dependencies) {
    if (!ids.has(dependency.predecessorId) || !ids.has(dependency.successorId)) {
      continue
    }

    outgoing.get(dependency.predecessorId)?.push(dependency.successorId)
    indegree.set(
      dependency.successorId,
      (indegree.get(dependency.successorId) ?? 0) + 1,
    )
  }

  const queue = todos
    .filter((todo) => (indegree.get(todo.id) ?? 0) === 0)
    .sort((a, b) => a.id - b.id)
    .map((todo) => todo.id)

  while (queue.length > 0) {
    const currentId = queue.shift()
    if (currentId === undefined) {
      continue
    }

    const currentLevel = levelById.get(currentId) ?? 0
    for (const nextId of outgoing.get(currentId) ?? []) {
      levelById.set(nextId, Math.max(levelById.get(nextId) ?? 0, currentLevel + 1))
      const nextDegree = (indegree.get(nextId) ?? 0) - 1
      indegree.set(nextId, nextDegree)
      if (nextDegree === 0) {
        queue.push(nextId)
      }
    }
  }

  return levelById
}

function getGroupKey(
  todo: DashboardTodo,
  tagPathById: Map<number, string>,
  selectedTagPath: string | null,
): string {
  const fullPath = todo.tagId ? (tagPathById.get(todo.tagId) ?? '') : ''
  if (!fullPath) {
    return 'untagged'
  }

  const segments = fullPath.split('/')
  if (!selectedTagPath) {
    return segments[0] ?? '(root)'
  }

  if (fullPath === selectedTagPath) {
    return 'same tag'
  }

  if (fullPath.startsWith(`${selectedTagPath}/`)) {
    const remainder = fullPath.slice(selectedTagPath.length + 1)
    return remainder.split('/')[0] ?? 'same tag'
  }

  return segments[0] ?? '(root)'
}

function getLaneType(groupKey: string): 'same_tag' | 'untagged' | 'default' {
  if (groupKey === 'same tag') {
    return 'same_tag'
  }

  if (groupKey === 'untagged') {
    return 'untagged'
  }

  return 'default'
}

export function toReactFlowGraph(
  todos: DashboardTodo[],
  dependencies: DashboardDependency[],
  tagPathById: Map<number, string>,
  selectedTagPath: string | null,
): {
  nodes: Node[]
  edges: Edge[]
} {
  const todoIds = new Set(todos.map((todo) => todo.id))
  const levelById = computeLevels(todos, dependencies)
  const predecessorMap = new Map<number, number[]>()

  for (const dependency of dependencies) {
    if (!todoIds.has(dependency.predecessorId) || !todoIds.has(dependency.successorId)) {
      continue
    }

    const predecessors = predecessorMap.get(dependency.successorId) ?? []
    predecessors.push(dependency.predecessorId)
    predecessorMap.set(dependency.successorId, predecessors)
  }

  for (const predecessors of predecessorMap.values()) {
    predecessors.sort((a, b) => a - b)
  }

  const groups = Array.from(
    new Set(
      todos
        .map((todo) => getGroupKey(todo, tagPathById, selectedTagPath))
        .sort((a, b) => a.localeCompare(b)),
    ),
  )

  const sortedTodos = [...todos].sort((a, b) => {
    const aGroup = getGroupKey(a, tagPathById, selectedTagPath)
    const bGroup = getGroupKey(b, tagPathById, selectedTagPath)
    if (aGroup !== bGroup) {
      return aGroup.localeCompare(bGroup)
    }

    const aLevel = levelById.get(a.id) ?? 0
    const bLevel = levelById.get(b.id) ?? 0
    if (aLevel !== bLevel) {
      return aLevel - bLevel
    }

    return a.id - b.id
  })

  const rowsByGroup = new Map<string, number>()
  const rowCountByGroup = new Map<string, number>()

  for (const todo of sortedTodos) {
    const groupKey = getGroupKey(todo, tagPathById, selectedTagPath)
    rowCountByGroup.set(groupKey, (rowCountByGroup.get(groupKey) ?? 0) + 1)
  }

  const groupOffsetByKey = new Map<string, number>()
  let currentOffset = 0
  const rowHeight = 244
  const groupGap = 56
  const cardWidth = 320
  const cardHeight = 206
  const framePaddingX = 42
  const framePaddingYTop = 42
  const framePaddingYBottom = 30

  for (const group of groups) {
    groupOffsetByKey.set(group, currentOffset)
    const rows = rowCountByGroup.get(group) ?? 1
    currentOffset += rows * rowHeight + groupGap
  }

  const columnWidth = 372

  const groupBounds = new Map<
    string,
    {
      minX: number
      maxX: number
      minY: number
      maxY: number
    }
  >()

  const nodes: Node[] = sortedTodos.map((todo) => {
    const groupKey = getGroupKey(todo, tagPathById, selectedTagPath)
    const rowIndex = rowsByGroup.get(groupKey) ?? 0
    rowsByGroup.set(groupKey, rowIndex + 1)

    const level = levelById.get(todo.id) ?? 0
    const tagPath = todo.tagId ? (tagPathById.get(todo.tagId) ?? '(unknown)') : '(untagged)'

    const x = level * columnWidth
    const y = (groupOffsetByKey.get(groupKey) ?? 0) + rowIndex * rowHeight

    const bounds = groupBounds.get(groupKey)
    if (!bounds) {
      groupBounds.set(groupKey, {
        minX: x,
        maxX: x,
        minY: y,
        maxY: y,
      })
    } else {
      bounds.minX = Math.min(bounds.minX, x)
      bounds.maxX = Math.max(bounds.maxX, x)
      bounds.minY = Math.min(bounds.minY, y)
      bounds.maxY = Math.max(bounds.maxY, y)
    }

    return {
      id: String(todo.id),
      type: 'todoCard',
      position: {
        x,
        y,
      },
      sourcePosition: Position.Right,
      targetPosition: Position.Left,
      data: {
        todoId: todo.id,
        title: todo.description,
        lane: groupKey,
        laneType: getLaneType(groupKey),
        tagPath,
        status: todo.status,
        isContext: todo.isContext ?? false,
        priority: todo.priority,
        dueDate: todo.dueDate,
        blocked: todo.isBlocked,
        predecessorIds: predecessorMap.get(todo.id) ?? [],
      },
      style: {
        width: cardWidth,
        border: 'none',
        background: 'transparent',
        boxShadow: 'none',
        padding: 0,
      },
    }
  })

  const groupNodes: Node[] = groups.flatMap((groupKey) => {
    const bounds = groupBounds.get(groupKey)
    if (!bounds) {
      return []
    }

    const x = bounds.minX - framePaddingX
    const y = bounds.minY - framePaddingYTop
    const width = bounds.maxX - bounds.minX + cardWidth + framePaddingX * 2
    const height = bounds.maxY - bounds.minY + cardHeight + framePaddingYTop + framePaddingYBottom

    return [
      {
        id: `group:${groupKey}`,
        type: 'groupBox',
        position: { x, y },
        data: { label: groupKey, laneType: getLaneType(groupKey) },
        selectable: false,
        draggable: false,
        focusable: false,
        zIndex: -1,
        style: {
          width,
          height,
          border: 'none',
          background: 'transparent',
          boxShadow: 'none',
          pointerEvents: 'none',
        },
      } satisfies Node,
    ]
  })

  const edges: Edge[] = dependencies
    .filter(
      (dependency) =>
        todoIds.has(dependency.predecessorId) && todoIds.has(dependency.successorId),
    )
    .map((dependency) => ({
      id: `${dependency.predecessorId}->${dependency.successorId}`,
      source: String(dependency.predecessorId),
      target: String(dependency.successorId),
      animated: false,
      type: 'smoothstep',
      markerEnd: {
        type: MarkerType.ArrowClosed,
        width: 16,
        height: 16,
      },
      style: {
        stroke: 'hsl(217 19% 45%)',
      },
    }))

  return { nodes: [...groupNodes, ...nodes], edges }
}
