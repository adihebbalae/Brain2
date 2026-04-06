export interface Project {
  name: string
  path: string
  status: 'active' | 'stale' | 'archived' | 'unknown'
  lastModified: string
  staleDays: number
  summary: string
  nextSteps: string[]
  todos: number
  openTodos: number
  hasDeadlines: boolean
}
