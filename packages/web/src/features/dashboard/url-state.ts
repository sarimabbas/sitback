export type DashboardUrlState = {
  view: 'list' | 'graph'
  tagId?: number
  untagged?: boolean
  q?: string
  status?: 'all' | 'todo' | 'in_progress' | 'completed'
  blocked?: 'all' | 'blocked' | 'unblocked'
  tag?: string
  sortBy?: 'id' | 'description' | 'status' | 'priority' | 'dueDate' | 'dependencies' | 'tag' | 'blocked'
  sortDir?: 'asc' | 'desc'
  todoId?: number
}

function parseNumber(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isInteger(value)) {
    return value
  }

  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value)
    if (Number.isInteger(parsed)) {
      return parsed
    }
  }

  return undefined
}

function parseStringUnion<T extends string>(
  value: unknown,
  allowed: readonly T[],
): T | undefined {
  if (typeof value !== 'string') {
    return undefined
  }

  return allowed.includes(value as T) ? (value as T) : undefined
}

export function validateDashboardSearch(
  search: Record<string, unknown>,
): DashboardUrlState {
  const view =
    parseStringUnion(search.view, ['list', 'graph'] as const) ?? 'list'

  const tagId = parseNumber(search.tagId)
  const todoId = parseNumber(search.todoId)
  const untagged = search.untagged === true || search.untagged === 'true' || search.untagged === '1'

  const q = typeof search.q === 'string' ? search.q : undefined
  const tag = typeof search.tag === 'string' ? search.tag : undefined

  const status =
    parseStringUnion(search.status, ['all', 'todo', 'in_progress', 'completed'] as const) ??
    'all'

  const blocked =
    parseStringUnion(search.blocked, ['all', 'blocked', 'unblocked'] as const) ??
    'all'

  const sortBy = parseStringUnion(
    search.sortBy,
    ['id', 'description', 'status', 'priority', 'dueDate', 'dependencies', 'tag', 'blocked'] as const,
  )

  const sortDir = parseStringUnion(search.sortDir, ['asc', 'desc'] as const)

  return {
    view,
    tagId,
    untagged,
    q,
    status,
    blocked,
    tag,
    sortBy,
    sortDir,
    todoId,
  }
}

export function applyDashboardSearchPatch(
  previous: DashboardUrlState,
  patch: Partial<DashboardUrlState>,
): DashboardUrlState {
  const next: DashboardUrlState = {
    ...previous,
    ...patch,
  }

  if (!next.q) {
    delete next.q
  }
  if (!next.tag) {
    delete next.tag
  }
  if (next.status === 'all') {
    delete next.status
  }
  if (next.blocked === 'all') {
    delete next.blocked
  }
  if (!next.sortBy) {
    delete next.sortBy
  }
  if (!next.sortDir) {
    delete next.sortDir
  }
  if (!next.todoId) {
    delete next.todoId
  }
  if (!next.tagId) {
    delete next.tagId
  }
  if (!next.untagged) {
    delete next.untagged
  }

  return next
}
