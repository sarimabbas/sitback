import { todosTable } from '@sitback/db/schema'
import { createServerFn } from '@tanstack/react-start'
import { desc, eq } from 'drizzle-orm'

export type TodoStatus = 'todo' | 'in_progress' | 'completed'

export type WebTodo = {
  id: number
  description: string
  status: TodoStatus
  priority: number | null
  dueDate: string | null
  createdAt: string
  updatedAt: string
}

export const fetchTodos = createServerFn({
  method: 'GET',
}).handler(async () => {
  const { db } = await import('@sitback/db/web')

  return await db
    .select({
      id: todosTable.id,
      description: todosTable.description,
      status: todosTable.status,
      priority: todosTable.priority,
      dueDate: todosTable.dueDate,
      createdAt: todosTable.createdAt,
      updatedAt: todosTable.updatedAt,
    })
    .from(todosTable)
    .orderBy(desc(todosTable.createdAt))
})

export const createTodo = createServerFn({
  method: 'POST',
})
  .inputValidator((data: { title: string }) => data)
  .handler(async ({ data }) => {
    const { db } = await import('@sitback/db/web')

    await db.insert(todosTable).values({
      description: data.title,
      status: 'todo',
    })

    return { success: true }
  })

export const updateTodoStatus = createServerFn({
  method: 'POST',
})
  .inputValidator((data: { id: number; status: TodoStatus }) => data)
  .handler(async ({ data }) => {
    const { db } = await import('@sitback/db/web')

    await db
      .update(todosTable)
      .set({ status: data.status })
      .where(eq(todosTable.id, data.id))

    return { success: true }
  })
