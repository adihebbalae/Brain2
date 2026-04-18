import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { promises as fs } from 'node:fs'
import path from 'node:path'
import request from 'supertest'
import express from 'express'
import { reviewRouter } from './review.js'
import { saveReviewLog } from '../lib/review-log.js'

describe('review routes', () => {
  let app: express.Application
  let tempDir: string
  let originalVaultDir: string | undefined

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(process.cwd(), 'test-review-routes-'))

    // Set VAULT_DIR to temp directory
    originalVaultDir = process.env.VAULT_DIR
    process.env.VAULT_DIR = tempDir

    // Create express app with review router
    app = express()
    app.use(express.json())
    app.use('/api/review', reviewRouter)
  })

  afterEach(async () => {
    // Restore original VAULT_DIR
    if (originalVaultDir !== undefined) {
      process.env.VAULT_DIR = originalVaultDir
    } else {
      delete process.env.VAULT_DIR
    }

    await fs.rm(tempDir, { recursive: true, force: true })
  })

  async function createNote(relativePath: string, content: string) {
    const absPath = path.join(tempDir, relativePath)
    await fs.mkdir(path.dirname(absPath), { recursive: true })
    await fs.writeFile(absPath, content, 'utf-8')
  }

  describe('GET /api/review/queue', () => {
    it('should return empty queue when log is empty', async () => {
      await saveReviewLog(tempDir, {})

      const response = await request(app).get('/api/review/queue')

      expect(response.status).toBe(200)
      expect(response.body).toEqual({
        queue: [],
        totalDue: 0,
        neverReviewed: 0
      })
    })

    it('should return queue with notes to review', async () => {
      const logData = {
        'notes/NeverReviewed.md': null,
        'notes/Current.md': new Date().toISOString()
      }
      await saveReviewLog(tempDir, logData)
      await createNote('notes/NeverReviewed.md', '# Never reviewed')
      await createNote('notes/Current.md', '# Current')

      const response = await request(app).get('/api/review/queue')

      expect(response.status).toBe(200)
      expect(response.body.queue.length).toBe(1)
      expect(response.body.queue[0].relativePath).toBe('notes/NeverReviewed.md')
      expect(response.body.totalDue).toBe(1)
      expect(response.body.neverReviewed).toBe(1)
    })

    it('should calculate totalDue and neverReviewed counts correctly', async () => {
      const date30 = new Date()
      date30.setDate(date30.getDate() - 35)

      const date60 = new Date()
      date60.setDate(date60.getDate() - 65)

      const current = new Date()
      current.setDate(current.getDate() - 15)

      const logData = {
        'notes/Never1.md': null,
        'notes/Never2.md': null,
        'notes/Overdue30.md': date30.toISOString(),
        'notes/Overdue60.md': date60.toISOString(),
        'notes/Current.md': current.toISOString()
      }
      await saveReviewLog(tempDir, logData)
      await createNote('notes/Never1.md', '# Never 1')
      await createNote('notes/Never2.md', '# Never 2')
      await createNote('notes/Overdue30.md', '# 30d')
      await createNote('notes/Overdue60.md', '# 60d')
      await createNote('notes/Current.md', '# Current')

      const response = await request(app).get('/api/review/queue')

      expect(response.status).toBe(200)
      expect(response.body.totalDue).toBe(4) // 2 never + 2 overdue
      expect(response.body.neverReviewed).toBe(2)
    })
  })

  describe('POST /api/review/log', () => {
    it('should mark note as reviewed', async () => {
      const logData = {
        'notes/MyNote.md': null
      }
      await saveReviewLog(tempDir, logData)
      await createNote('notes/MyNote.md', '# My Note')

      const beforeMark = new Date()
      const response = await request(app)
        .post('/api/review/log')
        .send({ filePath: 'notes/MyNote.md' })
      const afterMark = new Date()

      expect(response.status).toBe(200)
      expect(response.body.success).toBe(true)
      expect(response.body.reviewedAt).toBeDefined()

      const reviewedAt = new Date(response.body.reviewedAt)
      expect(reviewedAt.getTime()).toBeGreaterThanOrEqual(beforeMark.getTime())
      expect(reviewedAt.getTime()).toBeLessThanOrEqual(afterMark.getTime())
    })

    it('should reject empty filePath', async () => {
      const response = await request(app)
        .post('/api/review/log')
        .send({ filePath: '' })

      expect(response.status).toBe(400)
      expect(response.body.error).toContain('required')
    })

    it('should reject missing filePath', async () => {
      const response = await request(app)
        .post('/api/review/log')
        .send({})

      expect(response.status).toBe(400)
      expect(response.body.error).toContain('required')
    })

    it('should reject absolute paths', async () => {
      const response = await request(app)
        .post('/api/review/log')
        .send({ filePath: '/etc/passwd' })

      expect(response.status).toBe(400)
      expect(response.body.error).toContain('relative path')
    })

    it('should reject path traversal attempts', async () => {
      const response = await request(app)
        .post('/api/review/log')
        .send({ filePath: '../../etc/passwd' })

      expect(response.status).toBe(403)
      expect(response.body.error).toContain('within configured vault')
    })

    it('should normalize path separators', async () => {
      const logData = {
        'notes/MyNote.md': null
      }
      await saveReviewLog(tempDir, logData)
      await createNote('notes/MyNote.md', '# My Note')

      // Send with backslashes (Windows-style)
      const response = await request(app)
        .post('/api/review/log')
        .send({ filePath: 'notes\\MyNote.md' })

      expect(response.status).toBe(200)
      expect(response.body.success).toBe(true)
    })
  })

  describe('GET /api/review/queue/random', () => {
    it('should return null when log is empty', async () => {
      await saveReviewLog(tempDir, {})

      const response = await request(app).get('/api/review/queue/random')

      expect(response.status).toBe(200)
      expect(response.body.note).toBeNull()
    })

    it('should return a random note', async () => {
      const logData = {
        'notes/Note1.md': null,
        'notes/Note2.md': null,
        'notes/Note3.md': null
      }
      await saveReviewLog(tempDir, logData)
      await createNote('notes/Note1.md', '# Note 1')
      await createNote('notes/Note2.md', '# Note 2')
      await createNote('notes/Note3.md', '# Note 3')

      const response = await request(app).get('/api/review/queue/random')

      expect(response.status).toBe(200)
      expect(response.body.note).toBeDefined()
      expect(response.body.note.relativePath).toBeDefined()
      expect(response.body.note.title).toBeDefined()
      expect(response.body.note.preview).toBeDefined()
      expect(response.body.note.status).toBeDefined()
    })

    it('should include notes with current status', async () => {
      const recentDate = new Date()
      recentDate.setDate(recentDate.getDate() - 5) // Within 30 days

      const logData = {
        'notes/RecentNote.md': recentDate.toISOString()
      }
      await saveReviewLog(tempDir, logData)
      await createNote('notes/RecentNote.md', '# Recent')

      const response = await request(app).get('/api/review/queue/random')

      expect(response.status).toBe(200)
      expect(response.body.note).not.toBeNull()
      expect(response.body.note.status).toBe('current')
    })
  })
})
