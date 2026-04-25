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
  status: 'todo' | 'doing' | 'done'
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
  riskScore?: number | null
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

export type ImportKind =
  | 'claude'
  | 'chrome'
  | 'youtube'
  | 'calendar'
  | 'discover'
  | 'gemini'
  | 'notebooklm'

export type ImportStatus = 'queued' | 'running' | 'completed' | 'failed' | 'interrupted'
export type ImportJobType = 'scan' | 'normalize' | 'ingest'
export type ImportIngestMode = 'default' | 'rollups' | 'full-mirror'

export interface ImportDataset {
  id: string
  kind: ImportKind
  title: string
  sourceRoot: string
  sourcePaths: string[]
  sizeBytes: number
  fileCount: number
  warnings: string[]
  catalogOnly: boolean
  counts: Record<string, number>
  lastScannedAt: string
  lastNormalizedAt?: string
  lastIngestedAt?: string
  mirrorPath?: string
  normalized: boolean
  ingested: boolean
}

export interface ImportJobProgress {
  phase: string
  total: number
  completed: number
  current?: string
  errors: number
}

export interface ImportJob {
  id: string
  type: ImportJobType
  status: ImportStatus
  createdAt: string
  updatedAt: string
  startedAt?: string
  completedAt?: string
  datasetIds?: string[]
  mode?: ImportIngestMode
  progress: ImportJobProgress
  logs: string[]
  result?: Record<string, unknown>
  error?: string
}
