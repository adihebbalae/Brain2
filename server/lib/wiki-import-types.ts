export type ImportKind =
  | 'claude'
  | 'chrome'
  | 'youtube'
  | 'calendar'
  | 'discover'
  | 'gemini'
  | 'notebooklm'

export type ImportJobType = 'scan' | 'normalize' | 'ingest'
export type ImportJobStatus = 'queued' | 'running' | 'completed' | 'failed' | 'interrupted'
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

export interface ImportCatalog {
  lastScannedAt: string | null
  datasets: ImportDataset[]
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
  status: ImportJobStatus
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

export interface ImportJobRequest {
  type: ImportJobType
  datasetIds?: string[]
  mode?: ImportIngestMode
}

export interface NormalizeDatasetResult {
  datasetId: string
  counts: Record<string, number>
  warnings: string[]
  mirrorFiles: string[]
}

export interface IngestDatasetResult {
  datasetId: string
  mode: ImportIngestMode
  createdPages: string[]
  updatedPages: string[]
  skippedFiles: string[]
}
