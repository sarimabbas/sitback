import { createCollection } from '@tanstack/react-db'
import { queryCollectionOptions } from '@tanstack/query-db-collection'

import { getContext } from '@/integrations/tanstack-query/root-provider'
import { fetchTodos, type WebTodo, updateTodoStatus } from '@/server/todos'

const { queryClient } = getContext()

export const todosCollection = createCollection(
  queryCollectionOptions({
    queryKey: ['drizzle-todos'],
    queryClient,
    queryFn: async () => {
      return (await fetchTodos()) as WebTodo[]
    },
    getKey: (todo) => todo.id,
    refetchInterval: 1000,
    staleTime: 0,
    onUpdate: async ({ transaction }) => {
      await Promise.all(
        transaction.mutations
          .filter((mutation) => mutation.modified.status !== mutation.original.status)
          .map((mutation) =>
            updateTodoStatus({
              data: {
                id: mutation.original.id,
                status: mutation.modified.status,
              },
            }),
          ),
      )

      return { refetch: false }
    },
  }),
)
