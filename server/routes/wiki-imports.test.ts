import { describe, it, expect, beforeEach, vi } from 'vitest'
import request from 'supertest'
import express, { type Express } from 'express'
import { wikiRouter } from './wiki.js'

vi.mock('../lib/vault-config.js', () => ({
  getPrimaryVaultDir: vi.fn(),
  isPathInVault: vi.fn(),
}))

vi.mock('../lib/wiki-manager.js', () => ({
  ingestSource: vi.fn(),
  readIndex: vi.fn(),
  listPages: vi.fn(),
  ensureWikiExists: vi.fn(),
  queryWiki: vi.fn(),
  lintWiki: vi.fn(),
  analyzeGaps: vi.fn(),
  appendLog: vi.fn(),
}))

vi.mock('../lib/ollama-client.js', () => ({
  getOllamaStatus: vi.fn(),
}))

vi.mock('../lib/wiki-import-queue.js', () => ({
  enqueueImportJob: vi.fn(),
  getActiveImportJobs: vi.fn(),
  getImportJob: vi.fn(),
}))

vi.mock('../lib/wiki-imports.js', () => ({
  listWikiImportsState: vi.fn(),
}))

import {
  enqueueImportJob,
  getActiveImportJobs,
  getImportJob,
} from '../lib/wiki-import-queue.js'
import { listWikiImportsState } from '../lib/wiki-imports.js'

describe('wiki import routes', () => {
  let app: Express

  beforeEach(() => {
    vi.clearAllMocks()
    app = express()
    app.use(express.json())
    app.use('/api/wiki', wikiRouter)
  })

  it('returns import datasets with active jobs', async () => {
    vi.mocked(listWikiImportsState).mockResolvedValue({
      datasets: [
        {
          id: 'takeout:sample:youtube',
          kind: 'youtube',
          title: 'YouTube Export sample',
          sourceRoot: 'C:/data/sample',
          sourcePaths: ['C:/data/sample'],
          sizeBytes: 1024,
          fileCount: 4,
          warnings: [],
          catalogOnly: false,
          counts: { watchEvents: 12 },
          lastScannedAt: '2026-04-24T12:00:00.000Z',
          normalized: false,
          ingested: false,
        },
      ],
      lastScannedAt: '2026-04-24T12:00:00.000Z',
    })
    vi.mocked(getActiveImportJobs).mockResolvedValue([
      {
        id: 'job-1',
        type: 'scan',
        status: 'running',
        createdAt: '2026-04-24T12:00:00.000Z',
        updatedAt: '2026-04-24T12:00:01.000Z',
        progress: {
          phase: 'scanning',
          total: 1,
          completed: 0,
          errors: 0,
        },
        logs: [],
      },
    ])

    const response = await request(app)
      .get('/api/wiki/imports')
      .expect(200)

    expect(response.body.datasets).toHaveLength(1)
    expect(response.body.activeJobs).toHaveLength(1)
    expect(response.body.lastScannedAt).toBe('2026-04-24T12:00:00.000Z')
  })

  it('queues a scan job', async () => {
    vi.mocked(enqueueImportJob).mockResolvedValue({
      id: 'scan-job',
      type: 'scan',
      status: 'queued',
      createdAt: '2026-04-24T12:00:00.000Z',
      updatedAt: '2026-04-24T12:00:00.000Z',
      progress: {
        phase: 'queued',
        total: 0,
        completed: 0,
        errors: 0,
      },
      logs: [],
    })

    const response = await request(app)
      .post('/api/wiki/imports/scan')
      .expect(200)

    expect(enqueueImportJob).toHaveBeenCalledWith({ type: 'scan' })
    expect(response.body).toEqual({ jobId: 'scan-job' })
  })

  it('validates normalize datasetIds', async () => {
    const response = await request(app)
      .post('/api/wiki/imports/normalize')
      .send({ datasetIds: 'bad-value' })
      .expect(400)

    expect(response.body.error).toContain('datasetIds must be an array')
  })

  it('queues a normalize job with datasetIds', async () => {
    vi.mocked(enqueueImportJob).mockResolvedValue({
      id: 'normalize-job',
      type: 'normalize',
      status: 'queued',
      createdAt: '2026-04-24T12:00:00.000Z',
      updatedAt: '2026-04-24T12:00:00.000Z',
      progress: {
        phase: 'queued',
        total: 2,
        completed: 0,
        errors: 0,
      },
      logs: [],
      datasetIds: ['one', 'two'],
    })

    const response = await request(app)
      .post('/api/wiki/imports/normalize')
      .send({ datasetIds: ['one', 'two'] })
      .expect(200)

    expect(enqueueImportJob).toHaveBeenCalledWith({
      type: 'normalize',
      datasetIds: ['one', 'two'],
    })
    expect(response.body).toEqual({ jobId: 'normalize-job' })
  })

  it('requires datasetIds for ingest', async () => {
    const response = await request(app)
      .post('/api/wiki/imports/ingest')
      .send({ datasetIds: [] })
      .expect(400)

    expect(response.body.error).toContain('datasetIds is required')
  })

  it('queues an ingest job', async () => {
    vi.mocked(enqueueImportJob).mockResolvedValue({
      id: 'ingest-job',
      type: 'ingest',
      status: 'queued',
      createdAt: '2026-04-24T12:00:00.000Z',
      updatedAt: '2026-04-24T12:00:00.000Z',
      progress: {
        phase: 'queued',
        total: 1,
        completed: 0,
        errors: 0,
      },
      logs: [],
      datasetIds: ['takeout:sample:youtube'],
      mode: 'default',
    })

    const response = await request(app)
      .post('/api/wiki/imports/ingest')
      .send({ datasetIds: ['takeout:sample:youtube'], mode: 'default' })
      .expect(200)

    expect(enqueueImportJob).toHaveBeenCalledWith({
      type: 'ingest',
      datasetIds: ['takeout:sample:youtube'],
      mode: 'default',
    })
    expect(response.body).toEqual({ jobId: 'ingest-job' })
  })

  it('returns a persisted import job', async () => {
    vi.mocked(getImportJob).mockResolvedValue({
      id: 'job-42',
      type: 'ingest',
      status: 'completed',
      createdAt: '2026-04-24T12:00:00.000Z',
      updatedAt: '2026-04-24T12:10:00.000Z',
      completedAt: '2026-04-24T12:10:00.000Z',
      progress: {
        phase: 'completed',
        total: 1,
        completed: 1,
        errors: 0,
      },
      logs: ['done'],
      result: {
        datasetCount: 1,
      },
    })

    const response = await request(app)
      .get('/api/wiki/import-jobs/job-42')
      .expect(200)

    expect(response.body.id).toBe('job-42')
    expect(response.body.status).toBe('completed')
  })

  it('returns 404 for a missing import job', async () => {
    vi.mocked(getImportJob).mockResolvedValue(null)

    const response = await request(app)
      .get('/api/wiki/import-jobs/missing-job')
      .expect(404)

    expect(response.body.error).toContain('Job not found')
  })
})
