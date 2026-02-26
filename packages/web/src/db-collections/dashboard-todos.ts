import { createCollection } from '@tanstack/react-db'
import { queryCollectionOptions } from '@tanstack/query-db-collection'

import { getContext } from '@/integrations/tanstack-query/root-provider'
import {
  createDashboardTodo,
  deleteDashboardTodos,
  fetchDashboardTodos,
  updateDashboardTodo,
} from '@/server/dashboard'

import type { DashboardTodo } from '@/features/dashboard/types'

const { queryClient } = getContext()

export const dashboardTodosCollection = createCollection(
  queryCollectionOptions({
    queryKey: ['dashboard-todos'],
    queryClient,
    queryFn: async () => {
      return (await fetchDashboardTodos()) as DashboardTodo[]
    },
    getKey: (todo) => todo.id,
    refetchInterval: 750,
    staleTime: 0,
    onInsert: async ({ transaction }) => {
      const createdTodos = await Promise.all(
        transaction.mutations.map((mutation) => {
          const created = mutation.modified
          return createDashboardTodo({
            data: {
              description: created.description,
              status: created.status,
              tagId: created.tagId,
              priority: created.priority,
              dueDate: created.dueDate,
              workNotes: created.workNotes,
              assignee: created.assignee,
              assigneeLease: created.assigneeLease,
              predecessorIds: created.predecessorIds,
            },
          })
        }),
      )

      dashboardTodosCollection.utils.writeBatch(() => {
        for (const mutation of transaction.mutations) {
          dashboardTodosCollection.utils.writeDelete(mutation.key)
        }

        for (const todo of createdTodos) {
          dashboardTodosCollection.utils.writeInsert(todo)
        }
      })

      return { refetch: false }
    },
    onUpdate: async ({ transaction }) => {
      const mutationTasks = transaction.mutations
        .map((mutation) => {
          const descriptionChanged =
            mutation.modified.description !== mutation.original.description
          const assigneeChanged =
            mutation.modified.assignee !== mutation.original.assignee
          const assigneeLeaseChanged =
            mutation.modified.assigneeLease !== mutation.original.assigneeLease
          const workNotesChanged =
            mutation.modified.workNotes !== mutation.original.workNotes
          const statusChanged =
            mutation.modified.status !== mutation.original.status
          const priorityChanged =
            mutation.modified.priority !== mutation.original.priority
          const dueDateChanged =
            mutation.modified.dueDate !== mutation.original.dueDate
          const tagChanged = mutation.modified.tagId !== mutation.original.tagId

          if (
            !descriptionChanged &&
            !assigneeChanged &&
            !assigneeLeaseChanged &&
            !workNotesChanged &&
            !statusChanged &&
            !priorityChanged &&
            !dueDateChanged &&
            !tagChanged
          ) {
            return null
          }

          return updateDashboardTodo({
            data: {
              id: mutation.original.id,
              description: descriptionChanged
                ? mutation.modified.description
                : undefined,
              assignee: assigneeChanged ? mutation.modified.assignee : undefined,
              assigneeLease: assigneeLeaseChanged
                ? mutation.modified.assigneeLease
                : undefined,
              workNotes: workNotesChanged
                ? mutation.modified.workNotes
                : undefined,
              status: statusChanged ? mutation.modified.status : undefined,
              priority: priorityChanged ? mutation.modified.priority : undefined,
              dueDate: dueDateChanged ? mutation.modified.dueDate : undefined,
              tagId: tagChanged ? mutation.modified.tagId : undefined,
            },
          })
        })
        .filter((task): task is NonNullable<typeof task> => task !== null)

      await Promise.all(mutationTasks)

      return { refetch: false }
    },
    onDelete: async ({ transaction }) => {
      await deleteDashboardTodos({
        data: {
          ids: transaction.mutations.map((mutation) => mutation.key),
        },
      })

      return { refetch: false }
    },
  }),
)
