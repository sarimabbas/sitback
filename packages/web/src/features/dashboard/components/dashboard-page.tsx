import { GitBranch, Plus, Sparkles, Tag } from 'lucide-react'
import { useRef, useState } from 'react'
import type { SortingState, Updater } from '@tanstack/react-table'
import { toast } from 'sonner'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { dashboardTodosCollection } from '@/db-collections/dashboard-todos'
import {
  createDashboardTag,
  deleteDashboardTag,
  renameDashboardTag,
  setDashboardTodoPredecessors,
} from '@/server/dashboard'

import { TagTreeSidebar } from './tag-tree-sidebar'
import { TodoGraphView } from './todo-graph-view'
import { TodoListTable } from './todo-list-table'
import { TodoModal } from './todo-modal'
import { ViewToggle } from './view-toggle'
import { buildTagPathMap, filterTodosByTagScope, getTagScopeIds } from '../lib/filtering'
import { useDashboardData } from '../hooks/use-dashboard-data'
import type { DashboardTodo } from '../types'
import type { DashboardUrlState } from '../url-state'

function getPredecessorIds(
  todoId: number,
  allDependencies: Array<{ predecessorId: number; successorId: number }>,
) {
  return allDependencies
    .filter((dependency) => dependency.successorId === todoId)
    .map((dependency) => dependency.predecessorId)
    .sort((a, b) => a - b)
}

function normalizeSorting(search: DashboardUrlState): SortingState {
  if (!search.sortBy) {
    return []
  }

  return [
    {
      id: search.sortBy,
      desc: search.sortDir === 'desc',
    },
  ]
}

type DashboardPageProps = {
  search: DashboardUrlState
  setSearch: (patch: Partial<DashboardUrlState>) => void
}

export function DashboardPage({ search, setSearch }: DashboardPageProps) {
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
  const nextTempId = useRef(-1)

  const { data, isLoading, isError, refetchMetadata } = useDashboardData()

  const viewMode = search.view ?? 'list'
  const selectedTagId = search.tagId ?? null
  const selectedUntagged = search.untagged === true
  const query = search.q ?? ''
  const statusFilter = search.status ?? 'all'
  const blockedFilter = search.blocked ?? 'all'
  const tagFilterPath = search.tag ?? ''
  const sorting = normalizeSorting(search)

  if (isLoading) {
    return <div className="p-6 text-slate-600">Loading dashboard...</div>
  }

  if (isError || !data) {
    return <div className="p-6 text-red-700">Could not load dashboard data. Please refresh.</div>
  }

  const scopedTagIds = getTagScopeIds(data.tagTree, selectedTagId)

  const todoById = new Map(data.todos.map((todo) => [todo.id, todo]))
  const computedBlocked = new Map<number, boolean>()
  for (const todo of data.todos) {
    computedBlocked.set(todo.id, false)
  }
  for (const dependency of data.dependencies) {
    const predecessor = todoById.get(dependency.predecessorId)
    if (predecessor && predecessor.status !== 'completed') {
      computedBlocked.set(dependency.successorId, true)
    }
  }

  const todosWithComputedBlocked = data.todos.map((todo) => ({
    ...todo,
    isBlocked: computedBlocked.get(todo.id) ?? false,
  }))

  const tagPathMap = buildTagPathMap(data.tagTree)
  const selectedTagPath =
    selectedUntagged || !selectedTagId
      ? null
      : (tagPathMap.get(selectedTagId) ?? null)
  const scopedTodos = filterTodosByTagScope(todosWithComputedBlocked, scopedTagIds)
  const visibleTodos = selectedUntagged
    ? todosWithComputedBlocked.filter((todo) => todo.tagId === null)
    : scopedTodos
  const visibleTodoIds = new Set(visibleTodos.map((todo) => todo.id))

  const visibleDependencies = data.dependencies.filter(
    (dependency) =>
      visibleTodoIds.has(dependency.predecessorId) &&
      visibleTodoIds.has(dependency.successorId),
  )

  const selectedTodo = search.todoId
    ? todosWithComputedBlocked.find((todo) => todo.id === search.todoId)
    : undefined

  const selectedTodoPredecessors = selectedTodo
    ? getPredecessorIds(selectedTodo.id, data.dependencies)
    : []

  const handleSortingChange = (updater: Updater<SortingState>) => {
    const nextSorting = typeof updater === 'function' ? updater(sorting) : updater
    const first = nextSorting[0]

    if (!first) {
      setSearch({ sortBy: undefined, sortDir: undefined })
      return
    }

    setSearch({
      sortBy: first.id as DashboardUrlState['sortBy'],
      sortDir: first.desc ? 'desc' : 'asc',
    })
  }

  const handleCreateTodo = async (input: {
    description: string
    status: DashboardTodo['status']
    tagId: number | null
    priority: number | null
    dueDate: string | null
    assignee: string | null
    assigneeLease: string | null
    workNotes: string | null
    predecessorIds: number[]
  }) => {
    const now = new Date().toISOString().replace('T', ' ').slice(0, 19)
    const tempId = nextTempId.current
    nextTempId.current -= 1

    await dashboardTodosCollection.insert({
      id: tempId,
      description: input.description,
      status: input.status,
      tagId: input.tagId,
      assignee: input.assignee,
      assigneeLease: input.assigneeLease,
      workNotes: input.workNotes,
      priority: input.priority,
      dueDate: input.dueDate,
      createdAt: now,
      updatedAt: now,
      isBlocked: false,
      predecessorIds: input.predecessorIds,
    })

    await refetchMetadata()
    toast.success('Todo created')
  }

  const handlePatchTodo = async (id: number, changes: Partial<DashboardTodo>) => {
    await dashboardTodosCollection.update(id, (draft) => {
      if (changes.description !== undefined) draft.description = changes.description
      if (changes.status !== undefined) draft.status = changes.status
      if (changes.tagId !== undefined) draft.tagId = changes.tagId
      if (changes.priority !== undefined) draft.priority = changes.priority
      if (changes.dueDate !== undefined) draft.dueDate = changes.dueDate
      if (changes.assignee !== undefined) draft.assignee = changes.assignee
      if (changes.assigneeLease !== undefined) draft.assigneeLease = changes.assigneeLease
      if (changes.workNotes !== undefined) draft.workNotes = changes.workNotes
    })
    toast.success('Todo updated')
  }

  const handleDeleteTodo = async (id: number) => {
    await dashboardTodosCollection.delete(id)
    await refetchMetadata()

    if (search.todoId === id) {
      setSearch({ todoId: undefined })
    }

    toast.success('Todo deleted')
  }

  const handleSetPredecessors = async (id: number, predecessorIds: number[]) => {
    await setDashboardTodoPredecessors({
      data: {
        id,
        predecessorIds,
      },
    })
    await refetchMetadata()
  }

  const handleRenameTag = async (tagId: number, name: string) => {
    await renameDashboardTag({
      data: {
        id: tagId,
        name,
      },
    })
    await refetchMetadata()
    toast.success('Tag renamed')
  }

  const handleDeleteTag = async (tagId: number) => {
    await deleteDashboardTag({
      data: {
        id: tagId,
      },
    })

    if (selectedTagId === tagId) {
      setSearch({ tagId: undefined })
    }

    await refetchMetadata()
    toast.success('Tag deleted with nested children')
  }

  const handleCreateTag = async (name: string, parentId: number | null) => {
    await createDashboardTag({
      data: {
        name,
        parentId,
      },
    })
    await refetchMetadata()
    toast.success('Tag created')
  }

  const isEditModalOpen = selectedTodo !== undefined
  const modalOpen = isCreateModalOpen || isEditModalOpen
  const scopeLabel = selectedUntagged
    ? 'untagged'
    : selectedTagPath
      ? selectedTagPath
      : 'all tags'

  return (
    <div className="h-dvh overflow-hidden bg-gradient-to-b from-stone-50 via-amber-50/50 to-stone-100 p-3">
      <div className="grid h-full grid-cols-1 gap-3 lg:grid-cols-[320px_1fr]">
        <TagTreeSidebar
          tagTree={data.tagTree}
          selectedTagId={selectedTagId}
          selectedUntagged={selectedUntagged}
          onSelectTag={(tagId) =>
            setSearch({
              tagId: tagId ?? undefined,
              untagged: false,
            })
          }
          onSelectUntagged={() => setSearch({ tagId: undefined, untagged: true })}
          onRenameTag={handleRenameTag}
          onDeleteTag={handleDeleteTag}
          onCreateTag={handleCreateTag}
        />

        <section className="flex min-h-0 flex-col gap-3 overflow-hidden">
          <header className="rounded-xl border border-slate-200 bg-gradient-to-r from-white via-white to-sky-50/40 p-3 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="space-y-1">
                <p className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white/80 px-2 py-0.5 text-[11px] font-medium uppercase tracking-wide text-slate-600">
                  <Sparkles className="size-3" />
                  Workspace
                </p>
                <h1 className="text-xl font-semibold text-slate-900">Sitback Dashboard</h1>
                <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600">
                  <span className="inline-flex items-center gap-1 rounded-md border border-cyan-200 bg-cyan-50 px-1.5 py-0.5 text-cyan-800">
                    <Tag className="size-3" />
                    {scopeLabel}
                  </span>
                  <span className="inline-flex items-center gap-1 rounded-md border border-slate-300 bg-slate-100 px-1.5 py-0.5">
                    <GitBranch className="size-3" />
                    {visibleDependencies.length} links
                  </span>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline" className="border-slate-300 bg-white/80">
                  {visibleTodos.length} todos
                </Badge>
                <Badge variant="outline" className="border-slate-300 bg-white/80">
                  {visibleDependencies.length} edges
                </Badge>
                <div className="h-6 w-px bg-slate-200" />
                <Button
                  type="button"
                  size="sm"
                  className="shadow-sm"
                  onClick={() => {
                    setIsCreateModalOpen(true)
                    setSearch({ todoId: undefined })
                  }}
                >
                  <Plus className="size-4" />
                  Add Todo
                </Button>
                <ViewToggle
                  value={viewMode}
                  onChange={(next) => setSearch({ view: next })}
                />
              </div>
            </div>
          </header>

          <div className="min-h-0 flex-1">
            {viewMode === 'list' ? (
            <TodoListTable
              todos={visibleTodos}
              dependencies={visibleDependencies}
              tagTree={data.tagTree}
              selectedTagPath={selectedTagPath}
              query={query}
              statusFilter={statusFilter}
              blockedFilter={blockedFilter}
              tagFilterPath={tagFilterPath}
              sorting={sorting}
              onQueryChange={(value) => setSearch({ q: value })}
              onStatusFilterChange={(value) => setSearch({ status: value })}
              onBlockedFilterChange={(value) => setSearch({ blocked: value })}
              onTagFilterPathChange={(value) => setSearch({ tag: value.toLowerCase() })}
              onSortingChange={handleSortingChange}
              onFocusTodo={(todoId) => setSearch({ todoId })}
              onSelectTodo={(todo) => setSearch({ todoId: todo.id })}
              onDeleteTodo={handleDeleteTodo}
            />
          ) : (
            <TodoGraphView
              todos={visibleTodos}
              dependencies={visibleDependencies}
              tagTree={data.tagTree}
              selectedTagPath={selectedTagPath}
              onSelectTodo={(todoId) => setSearch({ todoId })}
            />
          )}
          </div>
        </section>
      </div>

      <TodoModal
        open={modalOpen}
        mode={isCreateModalOpen ? 'create' : 'edit'}
        initialTagId={selectedTagId}
        todo={selectedTodo}
        predecessorIds={selectedTodoPredecessors}
        tagTree={data.tagTree}
        allTodos={data.todos}
        onOpenChange={(open) => {
          if (!open) {
            setIsCreateModalOpen(false)
            setSearch({ todoId: undefined })
          }
        }}
        onCreateTodo={handleCreateTodo}
        onUpdateTodo={handlePatchTodo}
        onDeleteTodo={handleDeleteTodo}
        onSetPredecessors={handleSetPredecessors}
      />
    </div>
  )
}
