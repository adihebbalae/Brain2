export interface Project {
  name: string
  path: string
  vscodeUrl: string
  status: 'active' | 'stale' | 'archived' | 'unknown'
  lastModified: string
  staleDays: number
  summary: string
  nextSteps: string[]
  todos: number
  openTodos: number
  hasDeadlines: boolean
}

export interface Todo {
  id: string
  text: string
  done: boolean
  file: string
  line: number
  project: string
  type: 'checkbox' | 'TODO' | 'FIXME' | 'HACK'
}

export interface Deadline {
  id: string
  date: string
  description: string
  tag: string | null
  done: boolean
  urgency: 'red' | 'amber' | 'green' | 'gray'
}
