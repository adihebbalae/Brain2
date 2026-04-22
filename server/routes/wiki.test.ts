import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import request from 'supertest'
import express, { Express } from 'express'
import { wikiRouter } from './wiki.js'
import { promises as fs } from 'node:fs'
import path from 'node:path'
import os from 'node:os'

// Mock dependencies
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
}))

vi.mock('../lib/ollama-client.js', () => ({
  getOllamaStatus: vi.fn(),
}))

import { getPrimaryVaultDir } from '../lib/vault-config.js'
import { ingestSource, ensureWikiExists } from '../lib/wiki-manager.js'
import { getOllamaStatus } from '../lib/ollama-client.js'

describe('wiki routes - POST /api/wiki/ingest-projects', () => {
  let app: Express
  let originalProjectsDir: string | undefined
  let tempDir: string

  beforeEach(async () => {
    // Create temp directory for testing
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'wiki-test-'))

    // Set up test environment
    originalProjectsDir = process.env.PROJECTS_DIR
    process.env.PROJECTS_DIR = tempDir

    // Reset mocks
    vi.clearAllMocks()

    // Set up express app
    app = express()
    app.use(express.json())
    app.use('/api/wiki', wikiRouter)

    // Default mock implementations
    vi.mocked(getPrimaryVaultDir).mockReturnValue('/test/vault')
    vi.mocked(ensureWikiExists).mockResolvedValue(undefined)
  })

  afterEach(async () => {
    process.env.PROJECTS_DIR = originalProjectsDir

    // Clean up temp directory
    try {
      await fs.rm(tempDir, { recursive: true, force: true })
    } catch {
      // Ignore cleanup errors
    }
  })

  it('returns 200 with error when Ollama is unavailable', async () => {
    vi.mocked(getOllamaStatus).mockResolvedValue({
      available: false,
      model: 'llama3.1:8b',
      url: 'http://localhost:11434',
    })

    const response = await request(app)
      .post('/api/wiki/ingest-projects')
      .expect(200)

    expect(response.body).toEqual({
      ingested: 0,
      errors: ['Ollama not available — start it first'],
    })
  })

  it('returns 200 with ingested count when projects are found', async () => {
    vi.mocked(getOllamaStatus).mockResolvedValue({
      available: true,
      model: 'llama3.1:8b',
      url: 'http://localhost:11434',
    })

    // Create test project directories with state files
    const project1Dir = path.join(tempDir, 'Project1')
    const project2Dir = path.join(tempDir, 'Project2')
    await fs.mkdir(project1Dir)
    await fs.mkdir(project2Dir)

    // Create state files using priority order
    await fs.writeFile(path.join(project1Dir, 'agent_state.md'), '# Project 1 State')
    await fs.writeFile(path.join(project2Dir, 'README.md'), '# Project 2 README')

    // Mock ingestSource to succeed
    vi.mocked(ingestSource).mockResolvedValue({
      pagesCreated: ['Test Page'],
      pagesUpdated: [],
    })

    const response = await request(app)
      .post('/api/wiki/ingest-projects')
      .expect(200)

    expect(response.body.ingested).toBe(2)
    expect(response.body.errors).toEqual([])
    expect(ingestSource).toHaveBeenCalledTimes(2)
  })

  it('returns 200 with partial success when some ingests fail', async () => {
    vi.mocked(getOllamaStatus).mockResolvedValue({
      available: true,
      model: 'llama3.1:8b',
      url: 'http://localhost:11434',
    })

    // Create test project directories
    const project1Dir = path.join(tempDir, 'Project1')
    const project2Dir = path.join(tempDir, 'Project2')
    await fs.mkdir(project1Dir)
    await fs.mkdir(project2Dir)

    await fs.writeFile(path.join(project1Dir, 'state.md'), '# Project 1')
    await fs.writeFile(path.join(project2Dir, 'state.md'), '# Project 2')

    // Mock ingestSource: first succeeds, second fails
    vi.mocked(ingestSource)
      .mockResolvedValueOnce({
        pagesCreated: ['Page 1'],
        pagesUpdated: [],
      })
      .mockResolvedValueOnce({
        pagesCreated: [],
        pagesUpdated: [],
        error: 'Failed to parse',
      })

    const response = await request(app)
      .post('/api/wiki/ingest-projects')
      .expect(200)

    expect(response.body.ingested).toBe(1)
    expect(response.body.errors).toHaveLength(1)
    expect(response.body.errors[0]).toContain('Project2')
    expect(response.body.errors[0]).toContain('Failed to parse')
  })

  it('skips projects without state files', async () => {
    vi.mocked(getOllamaStatus).mockResolvedValue({
      available: true,
      model: 'llama3.1:8b',
      url: 'http://localhost:11434',
    })

    // Create test project directory without state file
    const projectDir = path.join(tempDir, 'EmptyProject')
    await fs.mkdir(projectDir)
    await fs.writeFile(path.join(projectDir, 'random.txt'), 'some content')

    const response = await request(app)
      .post('/api/wiki/ingest-projects')
      .expect(200)

    expect(response.body.ingested).toBe(0)
    expect(response.body.errors).toEqual([])
    expect(ingestSource).not.toHaveBeenCalled()
  })

  it('skips hidden directories (starting with .)', async () => {
    vi.mocked(getOllamaStatus).mockResolvedValue({
      available: true,
      model: 'llama3.1:8b',
      url: 'http://localhost:11434',
    })

    // Create hidden directory with state file
    const hiddenDir = path.join(tempDir, '.hidden')
    await fs.mkdir(hiddenDir)
    await fs.writeFile(path.join(hiddenDir, 'README.md'), '# Hidden')

    const response = await request(app)
      .post('/api/wiki/ingest-projects')
      .expect(200)

    expect(response.body.ingested).toBe(0)
    expect(ingestSource).not.toHaveBeenCalled()
  })

  it('uses state file priority order', async () => {
    vi.mocked(getOllamaStatus).mockResolvedValue({
      available: true,
      model: 'llama3.1:8b',
      url: 'http://localhost:11434',
    })

    // Create project with multiple state files
    const projectDir = path.join(tempDir, 'MultiStateProject')
    await fs.mkdir(projectDir)

    // Create files in reverse priority order
    await fs.writeFile(path.join(projectDir, 'README.md'), '# README')
    await fs.writeFile(path.join(projectDir, 'state.md'), '# State')
    await fs.writeFile(path.join(projectDir, 'agent_state.md'), '# Agent State')

    vi.mocked(ingestSource).mockResolvedValue({
      pagesCreated: ['Test'],
      pagesUpdated: [],
    })

    await request(app)
      .post('/api/wiki/ingest-projects')
      .expect(200)

    // Should use agent_state.md (highest priority)
    expect(ingestSource).toHaveBeenCalledTimes(1)
    const calledPath = vi.mocked(ingestSource).mock.calls[0][0]
    expect(calledPath).toContain('agent_state.md')
  })

  it('returns error when PROJECTS_DIR not configured', async () => {
    process.env.PROJECTS_DIR = ''

    vi.mocked(getOllamaStatus).mockResolvedValue({
      available: true,
      model: 'llama3.1:8b',
      url: 'http://localhost:11434',
    })

    const response = await request(app)
      .post('/api/wiki/ingest-projects')
      .expect(200)

    expect(response.body).toEqual({
      ingested: 0,
      errors: ['PROJECTS_DIR not configured'],
    })
  })
})
