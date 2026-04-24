import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import request from 'supertest'
import express, { Express } from 'express'
import { deadlinesRouter } from './deadlines.js'

// Mock the deadline-reader module
vi.mock('../lib/deadline-reader.js', () => ({
  readDeadlinesMultiVault: vi.fn(),
  addDeadline: vi.fn(),
  removeDeadline: vi.fn(),
  updateDeadline: vi.fn(),
}))

// Mock the vault-config module
vi.mock('../lib/vault-config.js', () => ({
  getVaultDirs: vi.fn()
}))

import { addDeadline, removeDeadline, updateDeadline } from '../lib/deadline-reader.js'
import { getVaultDirs } from '../lib/vault-config.js'

describe('deadlines routes', () => {
  let app: Express
  let originalVaultDir: string | undefined

  beforeEach(() => {
    // Set up test environment
    originalVaultDir = process.env.VAULT_DIR
    process.env.VAULT_DIR = '/test/vault'

    // Reset mocks
    vi.clearAllMocks()

    // Set up express app
    app = express()
    app.use(express.json())
    app.use('/api/deadlines', deadlinesRouter)

    // Default mock implementations
    vi.mocked(getVaultDirs).mockResolvedValue(['/test/vault'])
  })

  afterEach(() => {
    process.env.VAULT_DIR = originalVaultDir
  })

  describe('POST /api/deadlines', () => {
    it('returns 201 with DeadlineItem on valid body', async () => {
      const mockDeadline = {
        id: 'abc123def456',
        date: '2026-05-01',
        description: 'Test deadline',
        tag: null,
        done: false,
        urgency: 'green' as const,
        daysUntil: 10
      }

      vi.mocked(addDeadline).mockResolvedValue(mockDeadline)

      const response = await request(app)
        .post('/api/deadlines')
        .send({ date: '2026-05-01', description: 'Test deadline' })

      expect(response.status).toBe(201)
      expect(response.body).toEqual(mockDeadline)
      expect(addDeadline).toHaveBeenCalledWith('/test/vault', {
        date: '2026-05-01',
        description: 'Test deadline',
        tag: null,
        notes: null,
      })
    })

    it('passes notes when provided', async () => {
      const mockDeadline = {
        id: 'abc123def456',
        date: '2026-05-01',
        description: 'Test deadline',
        tag: 'school',
        notes: 'Submit via portal',
        done: false,
        urgency: 'green' as const,
        daysUntil: 10
      }

      vi.mocked(addDeadline).mockResolvedValue(mockDeadline)

      const response = await request(app)
        .post('/api/deadlines')
        .send({ date: '2026-05-01', description: 'Test deadline', tag: 'school', notes: 'Submit via portal' })

      expect(response.status).toBe(201)
      expect(addDeadline).toHaveBeenCalledWith('/test/vault', {
        date: '2026-05-01',
        description: 'Test deadline',
        tag: 'school',
        notes: 'Submit via portal',
      })
    })

    it('returns 201 with tag included', async () => {
      const mockDeadline = {
        id: 'abc123def456',
        date: '2026-05-01',
        description: 'Test deadline',
        tag: 'school',
        done: false,
        urgency: 'green' as const,
        daysUntil: 10
      }

      vi.mocked(addDeadline).mockResolvedValue(mockDeadline)

      const response = await request(app)
        .post('/api/deadlines')
        .send({ date: '2026-05-01', description: 'Test deadline', tag: 'school' })

      expect(response.status).toBe(201)
      expect(response.body.tag).toBe('school')
      expect(addDeadline).toHaveBeenCalledWith('/test/vault', {
        date: '2026-05-01',
        description: 'Test deadline',
        tag: 'school',
        notes: null,
      })
    })

    it('returns 400 when date is missing', async () => {
      const response = await request(app)
        .post('/api/deadlines')
        .send({ description: 'Test deadline' })

      expect(response.status).toBe(400)
      expect(response.body.error).toContain('Invalid date')
      expect(addDeadline).not.toHaveBeenCalled()
    })

    it('returns 400 when date is malformed', async () => {
      const response = await request(app)
        .post('/api/deadlines')
        .send({ date: 'not-a-date', description: 'Test deadline' })

      expect(response.status).toBe(400)
      expect(response.body.error).toContain('Invalid date')
      expect(addDeadline).not.toHaveBeenCalled()
    })

    it('returns 400 when description is missing', async () => {
      const response = await request(app)
        .post('/api/deadlines')
        .send({ date: '2026-05-01' })

      expect(response.status).toBe(400)
      expect(response.body.error).toContain('Description is required')
      expect(addDeadline).not.toHaveBeenCalled()
    })

    it('returns 400 when description is empty string', async () => {
      const response = await request(app)
        .post('/api/deadlines')
        .send({ date: '2026-05-01', description: '   ' })

      expect(response.status).toBe(400)
      expect(response.body.error).toContain('Description is required')
      expect(addDeadline).not.toHaveBeenCalled()
    })

    it('returns 500 when VAULT_DIR is not set', async () => {
      delete process.env.VAULT_DIR

      const response = await request(app)
        .post('/api/deadlines')
        .send({ date: '2026-05-01', description: 'Test deadline' })

      expect(response.status).toBe(500)
      expect(response.body.error).toContain('VAULT_DIR not configured')
      expect(addDeadline).not.toHaveBeenCalled()
    })
  })

  describe('DELETE /api/deadlines/:id', () => {
    it('returns 200 with success:true when deadline is found and removed', async () => {
      vi.mocked(removeDeadline).mockResolvedValue(true)

      const response = await request(app)
        .delete('/api/deadlines/abc123def456')

      expect(response.status).toBe(200)
      expect(response.body).toEqual({ success: true })
      expect(getVaultDirs).toHaveBeenCalled()
      expect(removeDeadline).toHaveBeenCalledWith(['/test/vault'], 'abc123def456')
    })

    it('returns 404 when deadline ID not found', async () => {
      vi.mocked(removeDeadline).mockResolvedValue(false)

      const response = await request(app)
        .delete('/api/deadlines/abc123def456')

      expect(response.status).toBe(404)
      expect(response.body.error).toContain('Deadline not found')
      expect(removeDeadline).toHaveBeenCalledWith(['/test/vault'], 'abc123def456')
    })

    it('returns 400 when ID format is invalid (not 12-char hex)', async () => {
      const response = await request(app)
        .delete('/api/deadlines/abc')

      expect(response.status).toBe(400)
      expect(response.body.error).toContain('Invalid deadline ID')
      expect(removeDeadline).not.toHaveBeenCalled()
    })

    it('returns 400 when ID contains non-hex characters', async () => {
      const response = await request(app)
        .delete('/api/deadlines/zzz123def456')

      expect(response.status).toBe(400)
      expect(response.body.error).toContain('Invalid deadline ID')
      expect(removeDeadline).not.toHaveBeenCalled()
    })

    it('returns 500 when VAULT_DIR is not set', async () => {
      delete process.env.VAULT_DIR

      const response = await request(app)
        .delete('/api/deadlines/abc123def456')

      expect(response.status).toBe(500)
      expect(response.body.error).toContain('VAULT_DIR not configured')
      expect(removeDeadline).not.toHaveBeenCalled()
    })
  })

  describe('PUT /api/deadlines/:id', () => {
    it('returns 200 with updated DeadlineItem on success', async () => {
      const mockUpdated = {
        id: 'abc123def456',
        date: '2026-05-01',
        description: 'Updated description',
        tag: 'school',
        notes: 'A note',
        done: false,
        urgency: 'green' as const,
        daysUntil: 10,
      }

      vi.mocked(updateDeadline).mockResolvedValue(mockUpdated)

      const response = await request(app)
        .put('/api/deadlines/abc123def456')
        .send({ description: 'Updated description', notes: 'A note' })

      expect(response.status).toBe(200)
      expect(response.body).toEqual(mockUpdated)
      expect(updateDeadline).toHaveBeenCalledWith(
        ['/test/vault'],
        'abc123def456',
        expect.objectContaining({ description: 'Updated description', notes: 'A note' })
      )
    })

    it('returns 404 when deadline ID not found', async () => {
      vi.mocked(updateDeadline).mockResolvedValue(null)

      const response = await request(app)
        .put('/api/deadlines/abc123def456')
        .send({ description: 'New' })

      expect(response.status).toBe(404)
      expect(response.body.error).toContain('Deadline not found')
    })

    it('returns 400 when ID format is invalid', async () => {
      const response = await request(app)
        .put('/api/deadlines/short')
        .send({ description: 'New' })

      expect(response.status).toBe(400)
      expect(response.body.error).toContain('Invalid deadline ID')
      expect(updateDeadline).not.toHaveBeenCalled()
    })

    it('returns 400 when date format is invalid', async () => {
      const response = await request(app)
        .put('/api/deadlines/abc123def456')
        .send({ date: 'not-a-date' })

      expect(response.status).toBe(400)
      expect(response.body.error).toContain('Invalid date')
      expect(updateDeadline).not.toHaveBeenCalled()
    })

    it('returns 400 when description is empty string', async () => {
      const response = await request(app)
        .put('/api/deadlines/abc123def456')
        .send({ description: '   ' })

      expect(response.status).toBe(400)
      expect(response.body.error).toContain('Description cannot be empty')
      expect(updateDeadline).not.toHaveBeenCalled()
    })

    it('returns 500 when VAULT_DIR is not set', async () => {
      delete process.env.VAULT_DIR

      const response = await request(app)
        .put('/api/deadlines/abc123def456')
        .send({ description: 'New' })

      expect(response.status).toBe(500)
      expect(response.body.error).toContain('VAULT_DIR not configured')
      expect(updateDeadline).not.toHaveBeenCalled()
    })

    it('marks deadline as done via done: true', async () => {
      const mockUpdated = {
        id: 'abc123def456',
        date: '2026-05-01',
        description: 'Task',
        tag: null,
        done: true,
        urgency: 'gray' as const,
        daysUntil: 10,
      }
      vi.mocked(updateDeadline).mockResolvedValue(mockUpdated)

      const response = await request(app)
        .put('/api/deadlines/abc123def456')
        .send({ done: true })

      expect(response.status).toBe(200)
      expect(response.body.done).toBe(true)
      expect(updateDeadline).toHaveBeenCalledWith(
        ['/test/vault'],
        'abc123def456',
        expect.objectContaining({ done: true })
      )
    })
  })
})
