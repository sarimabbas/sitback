import { useLiveQuery } from '@tanstack/react-db'
import { useQuery } from '@tanstack/react-query'

import { dashboardTodosCollection } from '@/db-collections/dashboard-todos'
import { fetchDashboardMetadata } from '@/server/dashboard'

export function useDashboardData() {
  const metadataQuery = useQuery({
    queryKey: ['dashboard-metadata'],
    queryFn: () => fetchDashboardMetadata(),
    staleTime: 0,
    refetchInterval: 2_000,
  })

  const { data: todos = [], isLoading: todosLoading } = useLiveQuery((q) =>
    q
      .from({ todo: dashboardTodosCollection })
      .orderBy(({ todo }) => todo.createdAt, 'desc')
      .select(({ todo }) => ({
        ...todo,
      })),
  )

  return {
    data: metadataQuery.data
      ? {
          tagTree: metadataQuery.data.tagTree,
          dependencies: metadataQuery.data.dependencies,
          todos,
        }
      : undefined,
    isLoading: metadataQuery.isLoading || todosLoading,
    isError: metadataQuery.isError,
    refetchMetadata: metadataQuery.refetch,
  }
}
