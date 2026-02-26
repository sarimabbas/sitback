import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

import { PathAutocompleteInput } from './path-autocomplete-input'
import { StatusMultiSelect } from './status-multi-select'

import type { DashboardTodoStatus } from '../types'

type DashboardFiltersBarProps = {
  query: string
  statusFilters: DashboardTodoStatus[]
  blockedFilter: 'all' | 'blocked' | 'unblocked'
  assigneeFilter: string
  assigneeOptions: string[]
  tagFilterPath: string
  tagPaths: string[]
  onQueryChange: (value: string) => void
  onStatusFiltersChange: (value: DashboardTodoStatus[]) => void
  onBlockedFilterChange: (value: 'all' | 'blocked' | 'unblocked') => void
  onAssigneeFilterChange: (value: string) => void
  onTagFilterPathChange: (value: string) => void
}

export function DashboardFiltersBar({
  query,
  statusFilters,
  blockedFilter,
  assigneeFilter,
  assigneeOptions,
  tagFilterPath,
  tagPaths,
  onQueryChange,
  onStatusFiltersChange,
  onBlockedFilterChange,
  onAssigneeFilterChange,
  onTagFilterPathChange,
}: DashboardFiltersBarProps) {
  return (
    <div className="grid gap-2 rounded-lg border border-slate-200 bg-slate-50/70 p-2 md:grid-cols-[1.4fr_1fr_1fr_1fr_1.2fr]">
      <Input
        name="dashboard-query"
        aria-label="Search todos"
        autoComplete="off"
        value={query}
        onChange={(event) => onQueryChange(event.target.value)}
        placeholder="Search by id, text, status, or tag…"
      />

      <StatusMultiSelect value={statusFilters} onChange={onStatusFiltersChange} />

      <Select
        value={blockedFilter}
        onValueChange={(value: 'all' | 'blocked' | 'unblocked') => onBlockedFilterChange(value)}
      >
        <SelectTrigger className="w-full" aria-label="Blocked filter">
          <SelectValue placeholder="Blocked" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All block states</SelectItem>
          <SelectItem value="blocked">Blocked</SelectItem>
          <SelectItem value="unblocked">Unblocked</SelectItem>
        </SelectContent>
      </Select>

      <Select
        value={assigneeFilter === '' ? '__all__' : assigneeFilter}
        onValueChange={(value) => onAssigneeFilterChange(value === '__all__' ? '' : value)}
      >
        <SelectTrigger className="w-full" aria-label="Assignee filter">
          <SelectValue placeholder="Assignee" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="__all__">All assignees</SelectItem>
          <SelectItem value="__unassigned__">Unassigned</SelectItem>
          {assigneeOptions.map((assignee) => (
            <SelectItem key={assignee} value={assignee}>
              {assignee}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <PathAutocompleteInput
        value={tagFilterPath}
        options={tagPaths}
        placeholder="Type tag path filter"
        onChange={onTagFilterPathChange}
        onSelect={onTagFilterPathChange}
      />
    </div>
  )
}
