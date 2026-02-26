export type DashboardTagNode = {
  id: number
  name: string
  parentId: number | null
  children: DashboardTagNode[]
}

export type DashboardTodoStatus = 'todo' | 'in_progress' | 'completed'

export type DashboardTodo = {
  id: number
  description: string
  tagId: number | null
  status: DashboardTodoStatus
  assignee: string | null
  assigneeLease: string | null
  workNotes: string | null
  priority: number | null
  dueDate: string | null
  createdAt: string
  updatedAt: string
  isBlocked: boolean
  predecessorIds?: number[]
}

export type DashboardDependency = {
  successorId: number
  predecessorId: number
}

export type DashboardData = {
  tagTree: DashboardTagNode[]
  todos: DashboardTodo[]
  dependencies: DashboardDependency[]
}

export type DashboardViewMode = 'list' | 'graph'
