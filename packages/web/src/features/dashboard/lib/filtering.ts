import type { DashboardTagNode, DashboardTodo } from '../types'

function findTagNodeById(
  nodes: DashboardTagNode[],
  targetId: number,
): DashboardTagNode | undefined {
  for (const node of nodes) {
    if (node.id === targetId) {
      return node
    }

    const match = findTagNodeById(node.children, targetId)
    if (match) {
      return match
    }
  }

  return undefined
}

function collectTagIds(node: DashboardTagNode, ids: Set<number>) {
  ids.add(node.id)

  for (const child of node.children) {
    collectTagIds(child, ids)
  }
}

export function getTagScopeIds(
  tagTree: DashboardTagNode[],
  selectedTagId: number | null,
): Set<number> | null {
  if (selectedTagId === null) {
    return null
  }

  const selectedNode = findTagNodeById(tagTree, selectedTagId)
  if (!selectedNode) {
    return new Set<number>()
  }

  const ids = new Set<number>()
  collectTagIds(selectedNode, ids)

  return ids
}

export function filterTodosByTagScope(
  todos: DashboardTodo[],
  tagScopeIds: Set<number> | null,
) {
  if (tagScopeIds === null) {
    return todos
  }

  return todos.filter((todo) => todo.tagId !== null && tagScopeIds.has(todo.tagId))
}

export function buildTagPathMap(tagTree: DashboardTagNode[]) {
  const byId = new Map<number, string>()

  const visit = (nodes: DashboardTagNode[], pathPrefix: string[]) => {
    for (const node of nodes) {
      const path = [...pathPrefix, node.name]
      byId.set(node.id, path.join('/'))
      visit(node.children, path)
    }
  }

  visit(tagTree, [])

  return byId
}

export function flattenTagTree(
  tagTree: DashboardTagNode[],
  prefix: string[] = [],
): Array<{ id: number; path: string; name: string }> {
  return tagTree.flatMap((node) => {
    const path = [...prefix, node.name]

    return [
      {
        id: node.id,
        path: path.join('/'),
        name: node.name,
      },
      ...flattenTagTree(node.children, path),
    ]
  })
}
