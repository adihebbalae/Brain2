import { useEffect, useMemo, useState } from 'react'
import { useWikiImports } from '../hooks/useWikiImports'
import type { ImportDataset, ImportIngestMode, ImportJob } from '../types'

interface ImportsPanelProps {
  onWikiUpdated?: () => void
}

export function ImportsPanel({ onWikiUpdated }: ImportsPanelProps) {
  const {
    datasets,
    activeJobs,
    lastScannedAt,
    lastJob,
    loading,
    error,
    scan,
    normalize,
    ingest,
    refetch,
  } = useWikiImports({ onIngestComplete: onWikiUpdated })

  const [selectedIds, setSelectedIds] = useState<string[]>([])

  const actionableDatasets = useMemo(
    () => datasets.filter(dataset => isActionableDataset(dataset)),
    [datasets],
  )
  const actionableIds = useMemo(
    () => new Set(actionableDatasets.map(dataset => dataset.id)),
    [actionableDatasets],
  )
  const selectedActionableIds = useMemo(
    () => selectedIds.filter(id => actionableIds.has(id)),
    [actionableIds, selectedIds],
  )
  const allActionableSelected = actionableDatasets.length > 0 && actionableDatasets.every(dataset => selectedActionableIds.includes(dataset.id))

  const normalizeTargets = selectedActionableIds.length > 0
    ? selectedActionableIds
    : actionableDatasets.map(dataset => dataset.id)
  const ingestTargets = (selectedActionableIds.length > 0
    ? datasets.filter(dataset => selectedActionableIds.includes(dataset.id))
    : actionableDatasets)
    .filter(dataset => dataset.needsIngest && !dataset.needsNormalization)
    .map(dataset => dataset.id)

  useEffect(() => {
    setSelectedIds(current => current.filter(id => actionableIds.has(id)))
  }, [actionableIds])

  const toggleDataset = (datasetId: string) => {
    setSelectedIds(current => current.includes(datasetId)
      ? current.filter(id => id !== datasetId)
      : [...current, datasetId])
  }

  const handleSelectAll = () => {
    if (allActionableSelected) {
      setSelectedIds([])
      return
    }

    setSelectedIds(actionableDatasets.map(dataset => dataset.id))
  }

  const handleNormalize = async () => {
    if (normalizeTargets.length === 0) {
      return
    }

    await normalize(normalizeTargets)
  }

  const handleIngest = async () => {
    if (ingestTargets.length === 0) {
      return
    }

    await ingest(ingestTargets, 'default')
  }

  const handleForceNormalize = async (datasetId: string) => {
    await normalize([datasetId], { force: true })
  }

  const handleForceIngest = async (datasetId: string, mode: ImportIngestMode = 'default') => {
    await ingest([datasetId], mode, { force: true })
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6 space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <h2 className="text-xl font-semibold">Imports</h2>
          <p className="mt-1 text-sm text-gray-600">
            Discover private exports in <code>data/</code>, mirror them locally, then promote only what you choose into the wiki.
          </p>
          <p className="mt-2 text-xs text-gray-500">
            Last scanned: {formatTimestamp(lastScannedAt)}
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => void refetch()}
            className="px-3 py-2 text-sm bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200"
          >
            Refresh
          </button>
          <button
            onClick={() => void scan()}
            className="px-3 py-2 text-sm bg-indigo-600 text-white rounded-md hover:bg-indigo-700"
          >
            Scan
          </button>
          <button
            onClick={() => void handleNormalize()}
            disabled={normalizeTargets.length === 0}
            className="px-3 py-2 text-sm bg-amber-500 text-white rounded-md hover:bg-amber-600 disabled:opacity-50"
          >
            Normalize
          </button>
          <button
            onClick={() => void handleIngest()}
            disabled={ingestTargets.length === 0}
            className="px-3 py-2 text-sm bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50"
          >
            Add To Wiki
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3 rounded-md bg-gray-50 border border-gray-200 px-3 py-2 text-sm">
        <label className="inline-flex items-center gap-2 text-gray-700">
          <input
            type="checkbox"
            checked={allActionableSelected}
            onChange={handleSelectAll}
            disabled={actionableDatasets.length === 0}
          />
          Select all datasets that still need work
        </label>
        <span className="text-gray-500">
          {selectedActionableIds.length} selected
        </span>
        <span className="text-gray-500">
          {actionableDatasets.length} actionable
        </span>
        <span className="text-gray-500">
          Greyed out = already current
        </span>
      </div>

      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      {(activeJobs.length > 0 || lastJob) && (
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-gray-700">Background Jobs</h3>
          {activeJobs.map(job => (
            <JobCard key={job.id} job={job} />
          ))}
          {lastJob && !activeJobs.some(job => job.id === lastJob.id) && (
            <JobCard job={lastJob} accent="border-gray-300" />
          )}
        </div>
      )}

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(item => (
            <div key={item} className="h-24 rounded-md bg-gray-100 animate-pulse" />
          ))}
        </div>
      ) : datasets.length === 0 ? (
        <div className="text-center py-10 border border-dashed border-gray-300 rounded-md">
          <p className="text-gray-600">No import datasets discovered yet.</p>
          <button
            onClick={() => void scan()}
            className="mt-3 px-4 py-2 text-sm bg-indigo-600 text-white rounded-md hover:bg-indigo-700"
          >
            Scan data directory
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {datasets.map(dataset => (
            <DatasetCard
              key={dataset.id}
              dataset={dataset}
              checked={selectedActionableIds.includes(dataset.id)}
              onToggle={() => toggleDataset(dataset.id)}
              onForceNormalize={() => void handleForceNormalize(dataset.id)}
              onForceIngest={() => void handleForceIngest(dataset.id, dataset.defaultIngestMode)}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function DatasetCard({
  dataset,
  checked,
  onToggle,
  onForceNormalize,
  onForceIngest,
}: {
  dataset: ImportDataset
  checked: boolean
  onToggle: () => void
  onForceNormalize: () => void
  onForceIngest: () => void
}) {
  const counts = Object.entries(dataset.counts).filter(([, value]) => value > 0)
  const isActionable = isActionableDataset(dataset)
  const isCurrent = !dataset.catalogOnly && !dataset.needsNormalization && !dataset.needsIngest
  const disabled = dataset.catalogOnly || !isActionable
  const statusText = getDatasetStatusText(dataset)

  return (
    <div className={`border rounded-lg p-4 transition-colors ${isCurrent ? 'border-gray-200 bg-gray-50 opacity-70' : 'border-gray-200 bg-white'}`}>
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div className="flex items-start gap-3">
          <input
            type="checkbox"
            checked={checked}
            disabled={disabled}
            onChange={onToggle}
            className="mt-1"
          />
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-base font-semibold text-gray-900">{dataset.title}</h3>
              <span className="px-2 py-0.5 rounded-full bg-gray-100 text-gray-700 text-xs uppercase tracking-wide">
                {dataset.kind}
              </span>
              <span className={`px-2 py-0.5 rounded-full text-xs ${getStatusBadgeClasses(dataset)}`}>
                {statusText}
              </span>
              {dataset.catalogOnly && (
                <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 text-xs">
                  Catalog only
                </span>
              )}
              {dataset.normalized && (
                <span className="px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 text-xs">
                  Mirrored
                </span>
              )}
              {dataset.ingested && (
                <span className="px-2 py-0.5 rounded-full bg-green-100 text-green-800 text-xs">
                  In wiki
                </span>
              )}
            </div>

            <p className="mt-1 text-sm text-gray-600 break-all">
              {dataset.sourceRoot}
            </p>
            <p className="mt-2 text-xs text-gray-500">
              {dataset.fileCount.toLocaleString()} files • {formatBytes(dataset.sizeBytes)} • default mode {dataset.defaultIngestMode}
            </p>
          </div>
        </div>

        <div className="text-xs text-gray-500 space-y-1">
          <p>Scanned: {formatTimestamp(dataset.lastScannedAt)}</p>
          <p>Normalized: {formatTimestamp(dataset.lastNormalizedAt)}</p>
          <p>Ingested: {formatTimestamp(dataset.lastIngestedAt)}</p>
        </div>
      </div>

      {counts.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {counts.map(([label, value]) => (
            <span
              key={label}
              className="px-2 py-1 rounded-md bg-gray-50 border border-gray-200 text-xs text-gray-700"
            >
              {label}: {value.toLocaleString()}
            </span>
          ))}
        </div>
      )}

      {dataset.warnings.length > 0 && (
        <div className="mt-3 space-y-1">
          {dataset.warnings.map(warning => (
            <div
              key={warning}
              className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800"
            >
              {warning}
            </div>
          ))}
        </div>
      )}

      {!dataset.catalogOnly && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {dataset.needsNormalization && (
            <span className="text-xs text-gray-600">
              Normalize this dataset before it can be refreshed in the wiki.
            </span>
          )}
          {!dataset.needsNormalization && dataset.needsIngest && (
            <span className="text-xs text-gray-600">
              Mirror is current. This dataset is ready to be added to the wiki.
            </span>
          )}
          {isCurrent && (
            <span className="text-xs text-gray-600">
              Mirror and wiki pages already match the latest scanned source snapshot.
            </span>
          )}
        </div>
      )}

      {!dataset.catalogOnly && (
        <div className="mt-3 flex flex-wrap gap-2">
          {(dataset.needsNormalization || dataset.normalized) && (
            <button
              onClick={onForceNormalize}
              className="px-3 py-1.5 text-xs bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200"
            >
              {dataset.normalized ? (isCurrent ? 'Re-normalize' : 'Force normalize') : 'Normalize'}
            </button>
          )}
          {dataset.normalized && (
            <button
              onClick={onForceIngest}
              className="px-3 py-1.5 text-xs bg-white text-green-700 border border-green-200 rounded-md hover:bg-green-50"
            >
              {dataset.ingested ? 'Re-ingest' : 'Add To Wiki'}
            </button>
          )}
        </div>
      )}
    </div>
  )
}

function JobCard({ job, accent = 'border-blue-200' }: { job: ImportJob; accent?: string }) {
  const total = Math.max(job.progress.total, 1)
  const percent = Math.min(100, Math.round((job.progress.completed / total) * 100))
  const failures = extractJobFailures(job)

  return (
    <div className={`rounded-lg border ${accent} bg-gray-50 p-4`}>
      <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-semibold text-gray-900">
              {job.type} job
            </span>
            <span className="px-2 py-0.5 rounded-full bg-white border border-gray-200 text-xs text-gray-700 uppercase">
              {job.status}
            </span>
            {job.force && (
              <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 text-xs uppercase">
                forced
              </span>
            )}
          </div>
          <p className="mt-1 text-xs text-gray-600">
            {job.progress.phase} • {job.progress.completed}/{job.progress.total} processed • {job.progress.errors} errors
          </p>
          {job.progress.current && (
            <p className="mt-1 text-xs text-gray-500">
              Current: {job.progress.current}
            </p>
          )}
          {job.error && (
            <p className="mt-2 text-xs text-red-700">{job.error}</p>
          )}
          {failures.length > 0 && (
            <div className="mt-2 space-y-1 text-xs text-red-700">
              {failures.slice(-3).map(failure => (
                <p key={`${failure.datasetId}-${failure.error}`}>
                  {failure.datasetId}: {failure.error}
                </p>
              ))}
              {failures.length > 3 && (
                <p>{failures.length - 3} more failure(s)</p>
              )}
            </div>
          )}
        </div>

        <p className="text-xs text-gray-500">
          Updated {formatTimestamp(job.updatedAt)}
        </p>
      </div>

      <div className="mt-3 h-2 rounded-full bg-gray-200 overflow-hidden">
        <div
          className="h-full bg-indigo-600 transition-all"
          style={{ width: `${percent}%` }}
        />
      </div>

      {job.logs.length > 0 && (
        <div className="mt-3 text-xs text-gray-600 max-h-28 overflow-y-auto space-y-1">
          {job.logs.slice(-4).map(line => (
            <p key={line}>{line}</p>
          ))}
        </div>
      )}
    </div>
  )
}

function isActionableDataset(dataset: ImportDataset): boolean {
  return !dataset.catalogOnly && (dataset.needsNormalization || dataset.needsIngest)
}

function getDatasetStatusText(dataset: ImportDataset): string {
  if (dataset.catalogOnly) {
    return 'Catalog only'
  }

  if (dataset.needsNormalization) {
    return dataset.normalized ? 'Source changed' : 'Needs normalize'
  }

  if (dataset.needsIngest) {
    return dataset.ingested ? 'Ready to refresh wiki' : 'Ready for wiki'
  }

  return 'Up to date'
}

function getStatusBadgeClasses(dataset: ImportDataset): string {
  if (dataset.catalogOnly) {
    return 'bg-amber-100 text-amber-800'
  }

  if (dataset.needsNormalization) {
    return 'bg-red-100 text-red-800'
  }

  if (dataset.needsIngest) {
    return 'bg-blue-100 text-blue-800'
  }

  return 'bg-emerald-100 text-emerald-800'
}

function formatTimestamp(value?: string | null): string {
  if (!value) {
    return 'Not yet'
  }

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return value
  }

  return date.toLocaleString()
}

function formatBytes(value: number): string {
  if (value < 1024) {
    return `${value} B`
  }

  if (value < 1024 * 1024) {
    return `${(value / 1024).toFixed(1)} KB`
  }

  if (value < 1024 * 1024 * 1024) {
    return `${(value / (1024 * 1024)).toFixed(1)} MB`
  }

  return `${(value / (1024 * 1024 * 1024)).toFixed(1)} GB`
}

function extractJobFailures(job: ImportJob): Array<{ datasetId: string; error: string }> {
  if (!job.result || typeof job.result !== 'object') {
    return []
  }

  const maybeFailures = (job.result as { failures?: unknown }).failures
  if (!Array.isArray(maybeFailures)) {
    return []
  }

  return maybeFailures.flatMap((failure) => {
    if (!failure || typeof failure !== 'object') {
      return []
    }

    const record = failure as Record<string, unknown>
    if (typeof record.datasetId !== 'string' || typeof record.error !== 'string') {
      return []
    }

    return [{
      datasetId: record.datasetId,
      error: record.error,
    }]
  })
}
