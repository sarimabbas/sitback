import { tagsTable, todoDependenciesTable, todosTable } from '@sitback/db/schema'
import { createServerFn } from '@tanstack/react-start'
import { eq, inArray, sql } from 'drizzle-orm'

import type { DashboardData, DashboardTagNode } from '@/features/dashboard/types'

type DashboardTodoRow = DashboardData['todos'][number]

const TODO_SELECT = {
  id: todosTable.id,
  description: todosTable.description,
  tagId: todosTable.tagId,
  status: todosTable.status,
  assignee: todosTable.assignee,
  assigneeLease: todosTable.assigneeLease,
  workNotes: todosTable.workNotes,
  priority: todosTable.priority,
  dueDate: todosTable.dueDate,
  createdAt: todosTable.createdAt,
  updatedAt: todosTable.updatedAt,
  isBlocked: sql<number>`case when exists (
    select 1
    from todo_dependencies d
    join todos p on p.id = d.predecessor_id
    where d.successor_id = ${todosTable.id}
      and p.status != 'completed'
  ) then 1 else 0 end`,
}

function mapTodoRow(
  todo: Omit<DashboardTodoRow, 'isBlocked'> & { isBlocked: number },
): DashboardTodoRow {
  return {
    ...todo,
    isBlocked: todo.isBlocked === 1,
  }
}

function validatePriority(value: number | null | undefined) {
  if (value === null || value === undefined) {
    return
  }

  if (!Number.isInteger(value) || value < 1 || value > 5) {
    throw new Error('Priority must be an integer between 1 and 5')
  }
}

function buildTagTree(
  rows: Array<{ id: number; name: string; parentId: number | null }>,
) {
  const nodeById = new Map<number, DashboardTagNode>(
    rows.map((row) => [
      row.id,
      {
        id: row.id,
        name: row.name,
        parentId: row.parentId,
        children: [],
      },
    ]),
  )

  const roots: DashboardTagNode[] = []

  for (const node of nodeById.values()) {
    if (node.parentId === null) {
      roots.push(node)
      continue
    }

    const parent = nodeById.get(node.parentId)
    if (!parent) {
      roots.push(node)
      continue
    }

    parent.children.push(node)
  }

  const sortNodes = (nodes: DashboardTagNode[]) => {
    nodes.sort((a, b) => a.name.localeCompare(b.name) || a.id - b.id)
    for (const node of nodes) {
      sortNodes(node.children)
    }
  }

  sortNodes(roots)
  return roots
}

export const fetchDashboardData = createServerFn({
  method: 'GET',
}).handler(async () => {
  const { db } = await import('@sitback/db/web')

  const [tagRows, todoRows, dependencies] = await Promise.all([
    db
      .select({
        id: tagsTable.id,
        name: tagsTable.name,
        parentId: tagsTable.parentId,
      })
      .from(tagsTable),
    db.select(TODO_SELECT).from(todosTable),
    db
      .select({
        predecessorId: todoDependenciesTable.predecessorId,
        successorId: todoDependenciesTable.successorId,
      })
      .from(todoDependenciesTable),
  ])

  const todos = todoRows.map(mapTodoRow)

  return {
    tagTree: buildTagTree(tagRows),
    todos,
    dependencies,
  } satisfies DashboardData
})

export const fetchDashboardMetadata = createServerFn({
  method: 'GET',
}).handler(async () => {
  const { db } = await import('@sitback/db/web')

  const [tagRows, dependencies] = await Promise.all([
    db
      .select({
        id: tagsTable.id,
        name: tagsTable.name,
        parentId: tagsTable.parentId,
      })
      .from(tagsTable),
    db
      .select({
        predecessorId: todoDependenciesTable.predecessorId,
        successorId: todoDependenciesTable.successorId,
      })
      .from(todoDependenciesTable),
  ])

  return {
    tagTree: buildTagTree(tagRows),
    dependencies,
  }
})

export const fetchDashboardTodos = createServerFn({
  method: 'GET',
}).handler(async () => {
  const { db } = await import('@sitback/db/web')

  const todoRows = await db.select(TODO_SELECT).from(todosTable)

  return todoRows.map((todo) => mapTodoRow(todo) satisfies DashboardTodoRow)
})

export const updateDashboardTodo = createServerFn({
  method: 'POST',
})
  .inputValidator(
    (data: {
      id: number
      status?: DashboardTodoRow['status']
      description?: string
      assignee?: string | null
      assigneeLease?: string | null
      workNotes?: string | null
      priority?: number | null
      dueDate?: string | null
      tagId?: number | null
    }) => data,
  )
  .handler(async ({ data }) => {
    const { db } = await import('@sitback/db/web')

    const changes: {
      status?: DashboardTodoRow['status']
      description?: string
      assignee?: string | null
      assigneeLease?: string | null
      workNotes?: string | null
      priority?: number | null
      dueDate?: string | null
      tagId?: number | null
    } = {}

    if (data.status !== undefined) {
      changes.status = data.status
    }
    if (data.description !== undefined) {
      changes.description = data.description.trim()
    }
    if (data.assignee !== undefined) {
      changes.assignee = data.assignee?.trim() || null
    }
    if (data.assigneeLease !== undefined) {
      changes.assigneeLease = data.assigneeLease?.trim() || null
    }
    if (data.workNotes !== undefined) {
      changes.workNotes = data.workNotes?.trim() || null
    }
    if (data.priority !== undefined) {
      validatePriority(data.priority)
      changes.priority = data.priority
    }
    if (data.dueDate !== undefined) {
      changes.dueDate = data.dueDate
    }
    if (data.tagId !== undefined) {
      changes.tagId = data.tagId
    }

    if (Object.keys(changes).length === 0) {
      return { success: true }
    }

    await db.update(todosTable).set(changes).where(eq(todosTable.id, data.id))

    return { success: true }
  })

export const createDashboardTodo = createServerFn({
  method: 'POST',
})
  .inputValidator(
    (data: {
      description: string
      status?: DashboardTodoRow['status']
      tagId?: number | null
      priority?: number | null
      dueDate?: string | null
      workNotes?: string | null
      assignee?: string | null
      assigneeLease?: string | null
      predecessorIds?: number[]
    }) => data,
  )
  .handler(async ({ data }) => {
    const { db } = await import('@sitback/db/web')

    const description = data.description.trim()
    if (description.length === 0) {
      throw new Error('Description is required')
    }

    validatePriority(data.priority)

    const [created] = await db
      .insert(todosTable)
      .values({
        description,
        status: data.status ?? 'todo',
        tagId: data.tagId ?? null,
        priority: data.priority ?? null,
        dueDate: data.dueDate ?? null,
        workNotes: data.workNotes?.trim() || null,
        assignee: data.assignee?.trim() || null,
        assigneeLease: data.assigneeLease?.trim() || null,
      })
      .returning({ id: todosTable.id })

    if (!created) {
      throw new Error('Failed to create todo')
    }

    const predecessorIds = Array.from(new Set(data.predecessorIds ?? []))
    if (predecessorIds.length > 0) {
      await db.insert(todoDependenciesTable).values(
        predecessorIds.map((predecessorId) => ({
          successorId: created.id,
          predecessorId,
        })),
      )
    }

    const [todo] = await db
      .select(TODO_SELECT)
      .from(todosTable)
      .where(eq(todosTable.id, created.id))

    if (!todo) {
      throw new Error('Created todo not found')
    }

    return mapTodoRow(todo)
  })

export const deleteDashboardTodos = createServerFn({
  method: 'POST',
})
  .inputValidator((data: { ids: number[] }) => data)
  .handler(async ({ data }) => {
    const { db } = await import('@sitback/db/web')
    const ids = Array.from(new Set(data.ids))

    if (ids.length === 0) {
      return { deletedIds: [] as number[] }
    }

    const deleted = await db
      .delete(todosTable)
      .where(inArray(todosTable.id, ids))
      .returning({ id: todosTable.id })

    return { deletedIds: deleted.map((row) => row.id) }
  })

export const setDashboardTodoPredecessors = createServerFn({
  method: 'POST',
})
  .inputValidator((data: { id: number; predecessorIds: number[] }) => data)
  .handler(async ({ data }) => {
    const { db } = await import('@sitback/db/web')

    const predecessorIds = Array.from(new Set(data.predecessorIds)).filter(
      (id) => id !== data.id,
    )

    await db
      .delete(todoDependenciesTable)
      .where(eq(todoDependenciesTable.successorId, data.id))

    if (predecessorIds.length > 0) {
      await db.insert(todoDependenciesTable).values(
        predecessorIds.map((predecessorId) => ({
          successorId: data.id,
          predecessorId,
        })),
      )
    }

    return { success: true }
  })

export const renameDashboardTag = createServerFn({
  method: 'POST',
})
  .inputValidator((data: { id: number; name: string }) => data)
  .handler(async ({ data }) => {
    const { db } = await import('@sitback/db/web')

    const nextName = data.name.trim().toLowerCase()
    if (!/^[a-z0-9]+$/.test(nextName)) {
      throw new Error('Tag name must be lowercase alphanumeric')
    }

    await db
      .update(tagsTable)
      .set({ name: nextName })
      .where(eq(tagsTable.id, data.id))

    return { success: true }
  })

export const deleteDashboardTag = createServerFn({
  method: 'POST',
})
  .inputValidator((data: { id: number }) => data)
  .handler(async ({ data }) => {
    const { db } = await import('@sitback/db/web')

    const deleted = await db
      .delete(tagsTable)
      .where(eq(tagsTable.id, data.id))
      .returning({ id: tagsTable.id })

    return {
      deleted: deleted.length > 0,
    }
  })

export const createDashboardTag = createServerFn({
  method: 'POST',
})
  .inputValidator((data: { name: string; parentId?: number | null }) => data)
  .handler(async ({ data }) => {
    const { db } = await import('@sitback/db/web')

    const nextName = data.name.trim().toLowerCase()
    if (!/^[a-z0-9]+$/.test(nextName)) {
      throw new Error('Tag name must be lowercase alphanumeric')
    }

    const [created] = await db
      .insert(tagsTable)
      .values({
        name: nextName,
        parentId: data.parentId ?? null,
      })
      .returning({ id: tagsTable.id })

    return {
      id: created?.id,
      success: Boolean(created),
    }
  })
