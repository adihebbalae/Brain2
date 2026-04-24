export interface Project {
  name: string
  path: string
  vscodeUrl: string
  status: 'active' | 'stale' | 'archived' | 'unknown'
  lastModified: string
  staleDays: number
  summary: string
  currentState?: string
  nextSteps: string[]
  todos: number
  openTodos: number
  hasDeadlines: boolean
  stateFile?: string
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
  notes?: string
  done: boolean
  urgency: 'red' | 'amber' | 'green' | 'gray'
  daysUntil: number
}

export interface ReadingItem {
  id: string
  title: string
  url: string
  read: boolean
  date?: Date | string
  source: 'bookmarks' | 'reading-log'
  tags: string[]
}

export interface ReadingResponse {
  total: number
  unread: number
  read: number
  items: ReadingItem[]
  topTopics: Array<{ topic: string; count: number }>
}
