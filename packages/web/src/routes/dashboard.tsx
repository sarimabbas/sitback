import { createFileRoute } from '@tanstack/react-router'

import { DashboardPage } from '@/features/dashboard/components/dashboard-page'
import {
  applyDashboardSearchPatch,
  validateDashboardSearch,
} from '@/features/dashboard/url-state'

export const Route = createFileRoute('/dashboard')({
  validateSearch: validateDashboardSearch,
  component: DashboardRoute,
})

function DashboardRoute() {
  const search = Route.useSearch()
  const navigate = Route.useNavigate()

  return (
    <DashboardPage
      search={search}
      setSearch={(patch) => {
        void navigate({
          search: (previous) => applyDashboardSearchPatch(previous, patch),
          replace: true,
        })
      }}
    />
  )
}
