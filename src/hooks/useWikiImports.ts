import { useCallback, useEffect, useRef, useState } from 'react'
import type { ImportDataset, ImportIngestMode, ImportJob } from '../types'

const API_BASE = 'http://localhost:3001'

interface UseWikiImportsOptions {
  onIngestComplete?: () => void
}

interface ImportsResponse {
  datasets: ImportDataset[]
  activeJobs: ImportJob[]
  lastScannedAt: string | null
}

export function useWikiImports(options: UseWikiImportsOptions = {}) {
  const onIngestComplete = options.onIngestComplete
  const [datasets, setDatasets] = useState<ImportDataset[]>([])
  const [activeJobs, setActiveJobs] = useState<ImportJob[]>([])
  const [lastScannedAt, setLastScannedAt] = useState<string | null>(null)
  const [lastJob, setLastJob] = useState<ImportJob | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const trackedJobIdRef = useRef<string | null>(null)
  const ingestNotifiedRef = useRef(new Set<string>())

  const fetchImports = useCallback(async () => {
    try {
      const response = await fetch(`${API_BASE}/api/wiki/imports`)
      if (!response.ok) {
        throw new Error(`Failed to fetch imports: ${response.statusText}`)
      }

      const data = await response.json() as ImportsResponse
      setDatasets(data.datasets || [])
      setActiveJobs(data.activeJobs || [])
      setLastScannedAt(data.lastScannedAt || null)

      if (!trackedJobIdRef.current && data.activeJobs.length > 0) {
        trackedJobIdRef.current = data.activeJobs[0].id
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch imports')
    } finally {
      setLoading(false)
    }
  }, [])

  const fetchJob = useCallback(async (jobId: string) => {
    try {
      const response = await fetch(`${API_BASE}/api/wiki/import-jobs/${jobId}`)
      if (!response.ok) {
        throw new Error(`Failed to fetch import job: ${response.statusText}`)
      }

      const job = await response.json() as ImportJob
      setLastJob(job)

      if (job.status !== 'queued' && job.status !== 'running') {
        if (trackedJobIdRef.current === job.id) {
          trackedJobIdRef.current = null
        }

        if (job.type === 'ingest' && job.status === 'completed' && !ingestNotifiedRef.current.has(job.id)) {
          ingestNotifiedRef.current.add(job.id)
          onIngestComplete?.()
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch import job')
    }
  }, [onIngestComplete])

  const queueJob = useCallback(async (
    path: string,
    body?: Record<string, unknown>,
  ): Promise<string | null> => {
    try {
      setError(null)
      const response = await fetch(`${API_BASE}${path}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body ?? {}),
      })

      if (!response.ok) {
        const data = await response.json().catch(() => ({}))
        throw new Error(data.error || `Failed to start job: ${response.statusText}`)
      }

      const data = await response.json() as { jobId: string }
      trackedJobIdRef.current = data.jobId
      await fetchImports()
      await fetchJob(data.jobId)
      return data.jobId
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start import job')
      return null
    }
  }, [fetchImports, fetchJob])

  const scan = useCallback(async () => queueJob('/api/wiki/imports/scan'), [queueJob])

  const normalize = useCallback(async (datasetIds?: string[]) => {
    return queueJob('/api/wiki/imports/normalize', datasetIds && datasetIds.length > 0 ? { datasetIds } : {})
  }, [queueJob])

  const ingest = useCallback(async (datasetIds: string[], mode: ImportIngestMode = 'default') => {
    return queueJob('/api/wiki/imports/ingest', { datasetIds, mode })
  }, [queueJob])

  useEffect(() => {
    void fetchImports()
  }, [fetchImports])

  useEffect(() => {
    const interval = window.setInterval(() => {
      void fetchImports()

      if (trackedJobIdRef.current) {
        void fetchJob(trackedJobIdRef.current)
      }
    }, 2500)

    return () => window.clearInterval(interval)
  }, [fetchImports, fetchJob])

  return {
    datasets,
    activeJobs,
    lastScannedAt,
    lastJob,
    loading,
    error,
    scan,
    normalize,
    ingest,
    refetch: fetchImports,
  }
}
