import crypto from 'node:crypto'
import path from 'node:path'
import { promises as fs } from 'node:fs'
import { ensureImportDirectories, getImportJobsDir } from './data-dir.js'
import {
  ingestImportDatasets,
  normalizeImportDatasets,
  readImportCatalog,
  scanImportDatasets,
} from './wiki-imports.js'
import type {
  ImportCatalog,
  ImportJob,
  ImportJobRequest,
  ImportJobStatus,
} from './wiki-import-types.js'

const ACTIVE_JOB_STATUSES = new Set<ImportJobStatus>(['queued', 'running'])

let initPromise: Promise<void> | null = null
const queuedJobIds: string[] = []
const queuedJobLookup = new Set<string>()
let workerPromise: Promise<void> | null = null

export function initWikiImportQueue(): Promise<void> {
  if (!initPromise) {
    initPromise = initializeQueue()
  }

  return initPromise
}

export async function enqueueImportJob(request: ImportJobRequest): Promise<ImportJob> {
  await initWikiImportQueue()

  const timestamp = new Date().toISOString()
  const job: ImportJob = {
    id: createJobId(),
    type: request.type,
    status: 'queued',
    createdAt: timestamp,
    updatedAt: timestamp,
    datasetIds: normalizeDatasetIds(request.datasetIds),
    mode: request.mode,
    force: request.force,
    progress: {
      phase: 'queued',
      total: request.datasetIds?.length ?? 0,
      completed: 0,
      errors: 0,
    },
    logs: [`Queued ${request.type} job at ${timestamp}`],
  }

  await writeImportJob(job)
  queueJob(job.id)
  startWorker()

  return job
}

export async function getImportJob(jobId: string): Promise<ImportJob | null> {
  await initWikiImportQueue()
  return readImportJob(jobId)
}

export async function getActiveImportJobs(): Promise<ImportJob[]> {
  await initWikiImportQueue()
  const jobs = await listImportJobs()
  return jobs.filter(job => ACTIVE_JOB_STATUSES.has(job.status))
}

async function initializeQueue(): Promise<void> {
  await ensureImportDirectories()

  const jobs = await listImportJobs()
  for (const job of jobs) {
    if (job.status === 'running') {
      await updateImportJob(job.id, current => ({
        ...current,
        status: 'interrupted',
        updatedAt: new Date().toISOString(),
        completedAt: current.completedAt ?? new Date().toISOString(),
        error: current.error ?? 'Interrupted by server restart',
        logs: appendLogLine(current.logs, 'Marked interrupted after restart'),
      }))
      continue
    }

    if (job.status === 'queued') {
      queueJob(job.id)
    }
  }

  startWorker()
}

function startWorker(): void {
  if (workerPromise) {
    return
  }

  workerPromise = processQueue()
    .catch(error => {
      console.error('[wiki-import-queue] Worker failed:', error)
    })
    .finally(() => {
      workerPromise = null
      if (queuedJobIds.length > 0) {
        startWorker()
      }
    })
}

async function processQueue(): Promise<void> {
  while (queuedJobIds.length > 0) {
    const jobId = queuedJobIds.shift()
    if (!jobId) {
      continue
    }

    queuedJobLookup.delete(jobId)
    await executeImportJob(jobId)
  }
}

async function executeImportJob(jobId: string): Promise<void> {
  const job = await readImportJob(jobId)
  if (!job || job.status !== 'queued') {
    return
  }

  const startedAt = new Date().toISOString()
  await updateImportJob(jobId, current => ({
    ...current,
    status: 'running',
    startedAt,
    updatedAt: startedAt,
    progress: {
      ...current.progress,
      phase: describeJobPhase(current.type),
      completed: 0,
      errors: 0,
    },
    logs: appendLogLine(current.logs, `Started ${current.type} job`),
    error: undefined,
  }))

  try {
    if (job.type === 'scan') {
      const catalog = await scanImportDatasets()
      await finalizeImportJob(jobId, 'completed', {
        datasetCount: catalog.datasets.length,
        lastScannedAt: catalog.lastScannedAt,
      })
      return
    }

    const catalog = await ensureCatalog()
    const datasetIds = resolveDatasetIds(catalog, job.datasetIds)
    const failures: Array<{ datasetId: string; error: string }> = []
    let processedCount = 0

    await updateImportJob(jobId, current => ({
      ...current,
      datasetIds,
      updatedAt: new Date().toISOString(),
      progress: {
        ...current.progress,
        phase: describeJobPhase(current.type),
        total: datasetIds.length,
        completed: 0,
        current: datasetIds[0],
        errors: 0,
      },
      logs: appendLogLine(current.logs, datasetIds.length === 0 ? 'No datasets selected' : `Resolved ${datasetIds.length} dataset(s)`),
    }))

    if (job.type === 'normalize') {
      const { catalog: updatedCatalog, results } = await normalizeImportDatasets(datasetIds, {
        onDatasetStart: async (dataset, index, total) => {
          await updateImportJob(jobId, current => ({
            ...current,
            updatedAt: new Date().toISOString(),
            progress: {
              ...current.progress,
              phase: 'normalizing',
              total,
              completed: processedCount,
              current: dataset.title,
            },
            logs: appendLogLine(current.logs, `Normalizing ${dataset.id} (${index + 1}/${total})`),
          }))
        },
        onDatasetComplete: async (dataset, result) => {
          processedCount += 1
          await updateImportJob(jobId, current => ({
            ...current,
            updatedAt: new Date().toISOString(),
            progress: {
              ...current.progress,
              phase: 'normalizing',
              completed: processedCount,
              current: dataset.title,
            },
            logs: appendLogLine(
              current.logs,
              result.skipped ? `Skipped normalize ${dataset.id}: ${result.skipReason ?? 'unchanged'}` : `Normalized ${dataset.id}`,
            ),
          }))
        },
        onDatasetError: async (dataset, error) => {
          processedCount += 1
          failures.push({ datasetId: dataset.id, error: error.message })
          await updateImportJob(jobId, current => ({
            ...current,
            updatedAt: new Date().toISOString(),
            progress: {
              ...current.progress,
              phase: 'normalizing',
              completed: processedCount,
              current: dataset.title,
              errors: failures.length,
            },
            logs: appendLogLine(current.logs, `Failed to normalize ${dataset.id}: ${error.message}`),
          }))
        },
      }, { force: job.force })

      await finalizeImportJob(
        jobId,
        results.length === 0 && failures.length > 0 ? 'failed' : 'completed',
        {
          datasetCount: datasetIds.length,
          lastScannedAt: updatedCatalog.lastScannedAt,
          results,
          failures,
        },
        summarizeDatasetFailures(failures, 'normalize', results.length),
      )
      return
    }

    const { catalog: updatedCatalog, results } = await ingestImportDatasets(datasetIds, job.mode ?? 'default', {
      onDatasetStart: async (dataset, index, total) => {
        await updateImportJob(jobId, current => ({
          ...current,
          updatedAt: new Date().toISOString(),
          progress: {
            ...current.progress,
            phase: 'ingesting',
            total,
            completed: processedCount,
            current: dataset.title,
          },
          logs: appendLogLine(current.logs, `Ingesting ${dataset.id} (${index + 1}/${total})`),
        }))
      },
      onDatasetComplete: async (dataset, result) => {
        processedCount += 1
        await updateImportJob(jobId, current => ({
          ...current,
          updatedAt: new Date().toISOString(),
          progress: {
            ...current.progress,
            phase: 'ingesting',
            completed: processedCount,
            current: dataset.title,
          },
          logs: appendLogLine(
            current.logs,
            result.skipped ? `Skipped ingest ${dataset.id}: ${result.skipReason ?? 'unchanged'}` : `Ingested ${dataset.id}`,
          ),
        }))
      },
      onDatasetError: async (dataset, error) => {
        processedCount += 1
        failures.push({ datasetId: dataset.id, error: error.message })
        await updateImportJob(jobId, current => ({
          ...current,
          updatedAt: new Date().toISOString(),
          progress: {
            ...current.progress,
            phase: 'ingesting',
            completed: processedCount,
            current: dataset.title,
            errors: failures.length,
          },
          logs: appendLogLine(current.logs, `Failed to ingest ${dataset.id}: ${error.message}`),
        }))
      },
    }, { force: job.force })

    await finalizeImportJob(
      jobId,
      results.length === 0 && failures.length > 0 ? 'failed' : 'completed',
      {
        datasetCount: datasetIds.length,
        lastScannedAt: updatedCatalog.lastScannedAt,
        results,
        failures,
      },
      summarizeDatasetFailures(failures, 'ingest', results.length),
    )
  } catch (error) {
    const normalized = error instanceof Error ? error : new Error(String(error))
    await finalizeImportJob(jobId, 'failed', undefined, normalized.message)
  }
}

async function finalizeImportJob(
  jobId: string,
  status: Extract<ImportJobStatus, 'completed' | 'failed'>,
  result?: Record<string, unknown>,
  error?: string,
): Promise<void> {
  const completedAt = new Date().toISOString()
  const completionLog = status === 'completed'
    ? error ? `Job completed with issues: ${error}` : 'Job completed successfully'
    : `Job failed${error ? `: ${error}` : ''}`

  await updateImportJob(jobId, current => ({
    ...current,
    status,
    updatedAt: completedAt,
    completedAt,
    progress: {
      ...current.progress,
      phase: status,
      current: undefined,
    },
    result,
    error,
    logs: appendLogLine(
      current.logs,
      completionLog,
    ),
  }))
}

function summarizeDatasetFailures(
  failures: Array<{ datasetId: string; error: string }>,
  operation: 'normalize' | 'ingest',
  successCount: number,
): string | undefined {
  if (failures.length === 0) {
    return undefined
  }

  const summary = `${failures.length} dataset(s) failed to ${operation}`
  return successCount === 0 ? summary : `${summary}; ${successCount} succeeded`
}

function describeJobPhase(type: ImportJob['type']): string {
  if (type === 'scan') {
    return 'scanning'
  }

  if (type === 'normalize') {
    return 'normalizing'
  }

  return 'ingesting'
}

async function ensureCatalog(): Promise<ImportCatalog> {
  let catalog = await readImportCatalog()
  if (catalog.datasets.length === 0) {
    catalog = await scanImportDatasets()
  }

  return catalog
}

function resolveDatasetIds(catalog: ImportCatalog, requestedIds?: string[]): string[] {
  if (!requestedIds || requestedIds.length === 0) {
    return catalog.datasets.map(dataset => dataset.id)
  }

  const available = new Set(catalog.datasets.map(dataset => dataset.id))
  return requestedIds.filter(datasetId => available.has(datasetId))
}

function normalizeDatasetIds(datasetIds?: string[]): string[] | undefined {
  if (!datasetIds || datasetIds.length === 0) {
    return undefined
  }

  return Array.from(new Set(datasetIds.map(datasetId => datasetId.trim()).filter(Boolean)))
}

function queueJob(jobId: string): void {
  if (queuedJobLookup.has(jobId)) {
    return
  }

  queuedJobIds.push(jobId)
  queuedJobLookup.add(jobId)
}

function createJobId(): string {
  return `import-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`
}

function getImportJobPath(jobId: string): string {
  return path.join(getImportJobsDir(), `${jobId}.json`)
}

async function readImportJob(jobId: string): Promise<ImportJob | null> {
  try {
    const content = await fs.readFile(getImportJobPath(jobId), 'utf-8')
    return JSON.parse(content) as ImportJob
  } catch {
    return null
  }
}

async function writeImportJob(job: ImportJob): Promise<void> {
  await fs.writeFile(getImportJobPath(job.id), JSON.stringify(job, null, 2), 'utf-8')
}

async function updateImportJob(jobId: string, updater: (job: ImportJob) => ImportJob): Promise<ImportJob | null> {
  const current = await readImportJob(jobId)
  if (!current) {
    return null
  }

  const updated = updater(current)
  await writeImportJob(updated)
  return updated
}

async function listImportJobs(): Promise<ImportJob[]> {
  let entries: string[] = []

  try {
    entries = await fs.readdir(getImportJobsDir())
  } catch {
    return []
  }

  const jobs: ImportJob[] = []
  for (const entry of entries) {
    if (!entry.endsWith('.json')) {
      continue
    }

    const job = await readImportJob(path.basename(entry, '.json'))
    if (job) {
      jobs.push(job)
    }
  }

  return jobs.sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
}

function appendLogLine(logs: string[], message: string): string[] {
  return [...logs, `${new Date().toISOString()} ${message}`].slice(-100)
}
