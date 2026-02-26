import {
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
} from '@tanstack/react-table'
import { ArrowDown, ArrowUp, ArrowUpDown, Link2, Trash2, User } from 'lucide-react'
import { useMemo } from 'react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

import { buildTagPathMap, flattenTagTree } from '../lib/filtering'
import type { DashboardDependency, DashboardTagNode, DashboardTodo } from '../types'
import { PathAutocompleteInput } from './path-autocomplete-input'

import type { ColumnDef, SortingState, Updater } from '@tanstack/react-table'
import type { FilterFn } from '@tanstack/react-table'
import type { MouseEvent } from 'react'

type TodoListTableProps = {
  todos: DashboardTodo[]
  dependencies: DashboardDependency[]
  tagTree: DashboardTagNode[]
  selectedTagPath: string | null
  query: string
  statusFilter: 'all' | DashboardTodo['status']
  blockedFilter: 'all' | 'blocked' | 'unblocked'
  tagFilterPath: string
  sorting: SortingState
  onQueryChange: (value: string) => void
  onStatusFilterChange: (value: 'all' | DashboardTodo['status']) => void
  onBlockedFilterChange: (value: 'all' | 'blocked' | 'unblocked') => void
  onTagFilterPathChange: (value: string) => void
  onSortingChange: (value: Updater<SortingState>) => void
  onFocusTodo: (todoId: number) => void
  onSelectTodo: (todo: DashboardTodo) => void
  onDeleteTodo: (id: number) => Promise<void>
}

function statusBadgeVariant(status: DashboardTodo['status']) {
  if (status === 'completed') return 'secondary' as const
  if (status === 'in_progress') return 'default' as const
  return 'outline' as const
}

function isOverdue(dueDate: string | null) {
  if (!dueDate) {
    return false
  }

  const today = new Date().toISOString().slice(0, 10)
  return dueDate < today
}

export function TodoListTable({
  todos,
  dependencies,
  tagTree,
  selectedTagPath,
  query,
  statusFilter,
  blockedFilter,
  tagFilterPath,
  sorting,
  onQueryChange,
  onStatusFilterChange,
  onBlockedFilterChange,
  onTagFilterPathChange,
  onSortingChange,
  onFocusTodo,
  onSelectTodo,
  onDeleteTodo,
}: TodoListTableProps) {
  const tagPathMap = useMemo(() => buildTagPathMap(tagTree), [tagTree])
  const tagOptions = useMemo(() => flattenTagTree(tagTree), [tagTree])
  const tagPaths = useMemo(() => tagOptions.map((tag) => tag.path), [tagOptions])

  const predecessorMap = useMemo(() => {
    const map = new Map<number, number[]>()
    for (const dependency of dependencies) {
      const list = map.get(dependency.successorId) ?? []
      list.push(dependency.predecessorId)
      map.set(dependency.successorId, list)
    }

    for (const entry of map.values()) {
      entry.sort((a, b) => a - b)
    }

    return map
  }, [dependencies])

  const filteredTodos = useMemo(() => {
    const normalized = query.trim().toLowerCase()

    return todos.filter((todo) => {
      if (statusFilter !== 'all' && todo.status !== statusFilter) {
        return false
      }

      if (blockedFilter === 'blocked' && !todo.isBlocked) {
        return false
      }

      if (blockedFilter === 'unblocked' && todo.isBlocked) {
        return false
      }

      if (tagFilterPath.trim() !== '') {
        const path = todo.tagId ? (tagPathMap.get(todo.tagId) ?? '') : ''
        if (!path.startsWith(tagFilterPath.trim().toLowerCase())) {
          return false
        }
      }

      if (!normalized) {
        return true
      }

      const tagPath = todo.tagId ? (tagPathMap.get(todo.tagId) ?? '') : ''

      return (
        String(todo.id).includes(normalized) ||
        todo.description.toLowerCase().includes(normalized) ||
        todo.status.includes(normalized) ||
        tagPath.toLowerCase().includes(normalized)
      )
    })
  }, [blockedFilter, query, statusFilter, tagFilterPath, tagPathMap, todos])

  const columns = useMemo<ColumnDef<DashboardTodo>[]>(
    () => [
      {
        accessorKey: 'id',
        header: 'ID',
        cell: ({ row }) => (
          <span className="inline-flex rounded border border-slate-300 bg-slate-100 px-1.5 py-0.5 font-mono text-[11px] text-slate-700">
            #{row.original.id}
          </span>
        ),
      },
      {
        accessorKey: 'description',
        header: 'Description',
        cell: ({ row }) => (
          <div className="space-y-1">
            <p className="line-clamp-2 max-w-[360px] text-sm font-semibold text-slate-900">
              {row.original.description}
            </p>
            <p className="flex items-center gap-1 text-[11px] text-slate-500">
              <User className="size-3" />
              {row.original.assignee ?? 'unassigned'}
            </p>
          </div>
        ),
      },
      {
        accessorKey: 'status',
        header: 'Status',
        cell: ({ row }) => (
          <Badge variant={statusBadgeVariant(row.original.status)}>
            {row.original.status}
          </Badge>
        ),
      },
      {
        accessorKey: 'priority',
        header: 'Priority',
        cell: ({ row }) => {
          if (row.original.priority === null) {
            return <span className="text-xs text-slate-500">none</span>
          }

          return (
            <span className="inline-flex rounded border border-slate-300 bg-slate-100 px-1.5 py-0.5 text-xs font-medium text-slate-800">
              P{row.original.priority}
            </span>
          )
        },
      },
      {
        accessorKey: 'dueDate',
        header: 'Due Date',
        cell: ({ row }) => {
          if (!row.original.dueDate) {
            return <span className="text-xs text-slate-500">none</span>
          }

          return (
            <span
              className={`inline-flex rounded border px-1.5 py-0.5 text-xs font-medium ${
                isOverdue(row.original.dueDate)
                  ? 'border-red-300 bg-red-100 text-red-800'
                  : 'border-slate-300 bg-slate-100 text-slate-800'
              }`}
            >
              {row.original.dueDate}
            </span>
          )
        },
      },
      {
        id: 'dependencies',
        header: 'Dependencies',
        cell: ({ row }) => {
          const ids = predecessorMap.get(row.original.id) ?? []
          if (ids.length === 0) {
            return <span className="text-xs text-slate-500">none</span>
          }

          return (
            <div className="flex flex-wrap gap-1">
              {ids.map((id) => (
                <button
                  key={id}
                  type="button"
                  className="inline-flex items-center gap-1 rounded border border-slate-300 bg-slate-100 px-1.5 py-0.5 text-xs text-slate-800 hover:bg-slate-200"
                  onClick={(event) => {
                    event.stopPropagation()
                    onFocusTodo(id)
                  }}
                >
                  <Link2 className="size-3" />#{id}
                </button>
              ))}
            </div>
          )
        },
      },
      {
        id: 'tag',
        header: 'Tag',
        cell: ({ row }) => {
          if (!row.original.tagId) {
            return (
              <span className="inline-flex rounded border border-amber-300 bg-amber-100 px-1.5 py-0.5 text-xs font-medium text-amber-900">
                untagged
              </span>
            )
          }

          const path = tagPathMap.get(row.original.tagId) ?? '(unknown)'
          const isSameTag = selectedTagPath !== null && path === selectedTagPath

          if (isSameTag) {
            return (
              <div className="space-y-0.5">
                <span className="inline-flex rounded border border-cyan-300 bg-cyan-100 px-1.5 py-0.5 text-xs font-medium text-cyan-900">
                  same tag
                </span>
                <p className="max-w-[180px] truncate text-xs text-slate-600">{path}</p>
              </div>
            )
          }

          return <span className="max-w-[180px] truncate text-xs text-slate-700">{path}</span>
        },
      },
      {
        id: 'blocked',
        header: 'Blocked',
        cell: ({ row }) =>
          row.original.isBlocked ? (
            <span className="inline-flex rounded border border-red-300 bg-red-100 px-1.5 py-0.5 text-xs font-medium text-red-800">
              blocked
            </span>
          ) : (
            <span className="inline-flex rounded border border-emerald-300 bg-emerald-100 px-1.5 py-0.5 text-xs font-medium text-emerald-800">
              clear
            </span>
          ),
      },
      {
        id: 'actions',
        header: 'Actions',
        cell: ({ row }) => (
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            className="text-red-700 hover:bg-red-50"
            onClick={(event: MouseEvent<HTMLButtonElement>) => {
              event.stopPropagation()
              void onDeleteTodo(row.original.id)
            }}
          >
            <Trash2 className="size-4" />
          </Button>
        ),
      },
    ],
    [onDeleteTodo, onFocusTodo, predecessorMap, selectedTagPath, tagPathMap],
  )

  const passthroughFilter: FilterFn<DashboardTodo> = () => true

  const table = useReactTable({
    data: filteredTodos,
    columns,
    filterFns: {
      passthrough: passthroughFilter,
    },
    state: { sorting },
    onSortingChange,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  })

  return (
    <section className="flex h-full min-h-0 flex-col overflow-hidden rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-slate-900">Todo list</h2>
        <span className="rounded border border-slate-300 bg-slate-100 px-2 py-0.5 text-xs text-slate-700">
          {filteredTodos.length} results
        </span>
      </div>

      <div className="mb-3 grid gap-2 rounded-lg border border-slate-200 bg-slate-50/70 p-2 md:grid-cols-[1.4fr_1fr_1fr_1.4fr]">
        <Input
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          placeholder="Search by id, text, status, or tag"
        />

        <Select
          value={statusFilter}
          onValueChange={(value: 'all' | DashboardTodo['status']) => onStatusFilterChange(value)}
        >
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="todo">todo</SelectItem>
            <SelectItem value="in_progress">in_progress</SelectItem>
            <SelectItem value="completed">completed</SelectItem>
          </SelectContent>
        </Select>

        <Select
          value={blockedFilter}
          onValueChange={(value: 'all' | 'blocked' | 'unblocked') => onBlockedFilterChange(value)}
        >
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Blocked" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All block states</SelectItem>
            <SelectItem value="blocked">Blocked</SelectItem>
            <SelectItem value="unblocked">Unblocked</SelectItem>
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

      <div className="min-h-0 flex-1 overflow-auto rounded-lg border border-slate-200">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id} className="sticky top-0 z-10 bg-slate-100/95">
                {headerGroup.headers.map((header) => (
                  <TableHead
                    key={header.id}
                    className="whitespace-normal py-2 text-[11px] uppercase tracking-wide text-slate-600"
                  >
                    {header.isPlaceholder ? null : (
                      <button
                        type="button"
                        className="inline-flex items-center gap-1 text-left"
                        onClick={header.column.getToggleSortingHandler()}
                      >
                        {flexRender(header.column.columnDef.header, header.getContext())}
                        {header.column.getCanSort() ? (
                          header.column.getIsSorted() === 'asc' ? (
                            <ArrowUp className="size-3" />
                          ) : header.column.getIsSorted() === 'desc' ? (
                            <ArrowDown className="size-3" />
                          ) : (
                            <ArrowUpDown className="size-3" />
                          )
                        ) : null}
                      </button>
                    )}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="py-10 text-center text-sm text-slate-500">
                  No todos match the current filters.
                </TableCell>
              </TableRow>
            ) : (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  className="cursor-pointer border-b border-slate-200/80 bg-white transition-colors hover:bg-slate-50"
                  onClick={() => onSelectTodo(row.original)}
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id} className="whitespace-normal align-top">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </section>
  )
}
