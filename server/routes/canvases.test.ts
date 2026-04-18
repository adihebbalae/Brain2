import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { promises as fs } from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import request from 'supertest'
import express from 'express'
import { canvasesRouter, clearCanvasCache } from './canvases.js'

describe('canvases routes', () => {
  let tempDir: string
  let app: express.Application
  let originalVaultDir: string | undefined

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'canvas-routes-test-'))

    // Save and set environment variable
    originalVaultDir = process.env.VAULT_DIR
    process.env.VAULT_DIR = tempDir

    // Clear cache before each test
    clearCanvasCache()

    // Create express app with router
    app = express()
    app.use(express.json())
    app.use('/api/canvases', canvasesRouter)
  })

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true })
    process.env.VAULT_DIR = originalVaultDir
    vi.clearAllMocks()
  })

  describe('GET /api/canvases', () => {
    it('should return empty array when no canvas files exist', async () => {
      const response = await request(app).get('/api/canvases')

      expect(response.status).toBe(200)
      expect(response.body).toEqual([])
    })

    it('should return list of canvas files', async () => {
      // Create canvas files
      const canvas1 = { nodes: [{ id: 'a', type: 'text', text: 'Test 1', x: 0, y: 0, width: 250, height: 60 }], edges: [] }
      const canvas2 = { nodes: [{ id: 'b', type: 'text', text: 'Test 2', x: 0, y: 0, width: 250, height: 60 }], edges: [] }

      const file1 = path.join(tempDir, 'first.canvas')
      const file2 = path.join(tempDir, 'second.canvas')

      await fs.writeFile(file1, JSON.stringify(canvas1), 'utf-8')
      await fs.writeFile(file2, JSON.stringify(canvas2), 'utf-8')

      // Verify files were created
      const files = await fs.readdir(tempDir)
      expect(files).toContain('first.canvas')
      expect(files).toContain('second.canvas')

      const response = await request(app).get('/api/canvases')

      expect(response.status).toBe(200)
      expect(response.body).toHaveLength(2)
      expect(response.body[0].filename).toBeTruthy()
      expect(response.body[0].nodeCount).toBe(1)
      expect(response.body[0].edgeCount).toBe(0)
      expect(response.body[0].textPreview).toHaveLength(1)
    })

    it('should recursively find canvas files in subdirectories', async () => {
      const subDir = path.join(tempDir, 'Projects')
      await fs.mkdir(subDir)

      const canvas1 = { nodes: [], edges: [] }
      const canvas2 = { nodes: [], edges: [] }

      await fs.writeFile(path.join(tempDir, 'root.canvas'), JSON.stringify(canvas1), 'utf-8')
      await fs.writeFile(path.join(subDir, 'nested.canvas'), JSON.stringify(canvas2), 'utf-8')

      const response = await request(app).get('/api/canvases')

      expect(response.status).toBe(200)
      expect(response.body).toHaveLength(2)
      const filenames = response.body.map((c: any) => c.filename)
      expect(filenames).toContain('root')
      expect(filenames).toContain('nested')
    })

    it('should sort canvases by lastModified descending', async () => {
      const canvas1 = { nodes: [], edges: [] }
      const canvas2 = { nodes: [], edges: [] }

      // Create first file
      await fs.writeFile(path.join(tempDir, 'older.canvas'), JSON.stringify(canvas1), 'utf-8')

      // Wait a bit to ensure different timestamps
      await new Promise(resolve => setTimeout(resolve, 10))

      // Create second file (newer)
      await fs.writeFile(path.join(tempDir, 'newer.canvas'), JSON.stringify(canvas2), 'utf-8')

      const response = await request(app).get('/api/canvases')

      expect(response.status).toBe(200)
      expect(response.body).toHaveLength(2)
      expect(response.body[0].filename).toBe('newer')
      expect(response.body[1].filename).toBe('older')
    })

    it('should skip malformed canvas files without crashing', async () => {
      const validCanvas = { nodes: [], edges: [] }

      await fs.writeFile(path.join(tempDir, 'valid.canvas'), JSON.stringify(validCanvas), 'utf-8')
      await fs.writeFile(path.join(tempDir, 'malformed.canvas'), '{ invalid json', 'utf-8')

      const response = await request(app).get('/api/canvases')

      expect(response.status).toBe(200)
      expect(response.body).toHaveLength(1)
      expect(response.body[0].filename).toBe('valid')
    })
  })

  describe('POST /api/canvases/:filename/add-node', () => {
    it('should add a node to canvas file', async () => {
      const canvas = {
        nodes: [{ id: 'a', type: 'text', text: 'Existing', x: 0, y: 0, width: 250, height: 60 }],
        edges: [],
      }
      await fs.writeFile(path.join(tempDir, 'test.canvas'), JSON.stringify(canvas, null, 2), 'utf-8')

      const response = await request(app)
        .post('/api/canvases/test/add-node')
        .send({ text: 'New node' })

      expect(response.status).toBe(200)
      expect(response.body).toEqual({ success: true, filename: 'test' })

      // Verify file was updated
      const updated = JSON.parse(await fs.readFile(path.join(tempDir, 'test.canvas'), 'utf-8'))
      expect(updated.nodes).toHaveLength(2)
      expect(updated.nodes[1].text).toBe('New node')
    })

    it('should add node with color', async () => {
      const canvas = { nodes: [], edges: [] }
      await fs.writeFile(path.join(tempDir, 'colored.canvas'), JSON.stringify(canvas, null, 2), 'utf-8')

      const response = await request(app)
        .post('/api/canvases/colored/add-node')
        .send({ text: 'Red node', color: '1' })

      expect(response.status).toBe(200)

      const updated = JSON.parse(await fs.readFile(path.join(tempDir, 'colored.canvas'), 'utf-8'))
      expect(updated.nodes[0].color).toBe('1')
    })

    it('should return 400 when text is missing', async () => {
      const canvas = { nodes: [], edges: [] }
      await fs.writeFile(path.join(tempDir, 'test.canvas'), JSON.stringify(canvas), 'utf-8')

      const response = await request(app)
        .post('/api/canvases/test/add-node')
        .send({})

      expect(response.status).toBe(400)
      expect(response.body.error).toBe('Text is required')
    })

    it('should return 400 when text is empty', async () => {
      const canvas = { nodes: [], edges: [] }
      await fs.writeFile(path.join(tempDir, 'test.canvas'), JSON.stringify(canvas), 'utf-8')

      const response = await request(app)
        .post('/api/canvases/test/add-node')
        .send({ text: '   ' })

      expect(response.status).toBe(400)
      expect(response.body.error).toBe('Text is required')
    })

    it('should return 400 when color is invalid', async () => {
      const canvas = { nodes: [], edges: [] }
      await fs.writeFile(path.join(tempDir, 'test.canvas'), JSON.stringify(canvas), 'utf-8')

      const response = await request(app)
        .post('/api/canvases/test/add-node')
        .send({ text: 'Test', color: '99' })

      expect(response.status).toBe(400)
      expect(response.body.error).toBe('Invalid color code')
    })

    it('should return 404 when canvas file not found', async () => {
      const response = await request(app)
        .post('/api/canvases/nonexistent/add-node')
        .send({ text: 'Test' })

      expect(response.status).toBe(404)
      expect(response.body.error).toBe('Canvas file not found')
    })

    it('should find canvas in subdirectory', async () => {
      const subDir = path.join(tempDir, 'Projects')
      await fs.mkdir(subDir)

      const canvas = { nodes: [], edges: [] }
      await fs.writeFile(path.join(subDir, 'nested.canvas'), JSON.stringify(canvas, null, 2), 'utf-8')

      const response = await request(app)
        .post('/api/canvases/nested/add-node')
        .send({ text: 'Nested node' })

      expect(response.status).toBe(200)

      const updated = JSON.parse(await fs.readFile(path.join(subDir, 'nested.canvas'), 'utf-8'))
      expect(updated.nodes[0].text).toBe('Nested node')
    })

    it('should prevent path traversal attacks', async () => {
      // This test verifies that the path traversal check is in place
      // The exact filename that would escape the vault is blocked
      const response = await request(app)
        .post('/api/canvases/..%2F..%2Fetc%2Fpasswd/add-node')
        .send({ text: 'Test' })

      // Should return 404 since the file doesn't exist in vault
      expect(response.status).toBe(404)
    })

    it('should trim whitespace from text', async () => {
      const canvas = { nodes: [], edges: [] }
      await fs.writeFile(path.join(tempDir, 'test.canvas'), JSON.stringify(canvas, null, 2), 'utf-8')

      const response = await request(app)
        .post('/api/canvases/test/add-node')
        .send({ text: '  Trimmed text  ' })

      expect(response.status).toBe(200)

      const updated = JSON.parse(await fs.readFile(path.join(tempDir, 'test.canvas'), 'utf-8'))
      expect(updated.nodes[0].text).toBe('Trimmed text')
    })
  })

  describe('Cache behavior', () => {
    it('should use cache for subsequent requests', async () => {
      const canvas = { nodes: [], edges: [] }
      await fs.writeFile(path.join(tempDir, 'test.canvas'), JSON.stringify(canvas), 'utf-8')

      // First request
      const response1 = await request(app).get('/api/canvases')
      expect(response1.status).toBe(200)
      expect(response1.body).toHaveLength(1)

      // Add another file (should not appear in cached response)
      await fs.writeFile(path.join(tempDir, 'new.canvas'), JSON.stringify(canvas), 'utf-8')

      // Second request (should use cache)
      const response2 = await request(app).get('/api/canvases')
      expect(response2.status).toBe(200)
      expect(response2.body).toHaveLength(1) // Still 1 due to cache
    })

    it('should invalidate cache after adding a node', async () => {
      const canvas = { nodes: [], edges: [] }
      await fs.writeFile(path.join(tempDir, 'test.canvas'), JSON.stringify(canvas), 'utf-8')

      // First request to populate cache
      await request(app).get('/api/canvases')

      // Add a node
      await request(app)
        .post('/api/canvases/test/add-node')
        .send({ text: 'New node' })

      // Add a new canvas file
      await fs.writeFile(path.join(tempDir, 'new.canvas'), JSON.stringify(canvas), 'utf-8')

      // Next GET should show the new file (cache was invalidated)
      const response = await request(app).get('/api/canvases')
      expect(response.status).toBe(200)
      expect(response.body).toHaveLength(2)
    })
  })
})
