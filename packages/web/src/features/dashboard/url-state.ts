export type DashboardUrlState = {
  view: 'list' | 'graph'
  tagId?: number
  untagged?: boolean
  q?: string
  statuses?: Array<'todo' | 'in_progress' | 'completed' | 'cancelled'>
  blocked?: 'all' | 'blocked' | 'unblocked'
  assignee?: string
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

function parseStatusFilters(value: unknown): DashboardUrlState['statuses'] {
  const allowed = ['todo', 'in_progress', 'completed', 'cancelled'] as const

  const normalizedValues = Array.isArray(value)
    ? value
    : typeof value === 'string'
      ? value.split(',')
      : []

  const statuses = normalizedValues
    .filter((item): item is string => typeof item === 'string')
    .map((item) => item.trim())
    .filter((item): item is (typeof allowed)[number] =>
      allowed.includes(item as (typeof allowed)[number]),
    )

  if (statuses.length === 0) {
    return undefined
  }

  return Array.from(new Set(statuses))
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

  const statuses = parseStatusFilters(search.statuses)
  const legacyStatus = parseStringUnion(
    search.status,
    ['all', 'todo', 'in_progress', 'completed', 'cancelled'] as const,
  )
  const mergedStatuses =
    statuses ??
    (legacyStatus && legacyStatus !== 'all' ? [legacyStatus] : undefined)

  const blocked =
    parseStringUnion(search.blocked, ['all', 'blocked', 'unblocked'] as const) ??
    'all'

  const assignee = typeof search.assignee === 'string' ? search.assignee : undefined

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
    statuses: mergedStatuses,
    blocked,
    assignee,
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
  if (!next.statuses || next.statuses.length === 0) {
    delete next.statuses
  }
  if (next.blocked === 'all') {
    delete next.blocked
  }
  if (!next.assignee) {
    delete next.assignee
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
