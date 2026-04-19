import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import request from 'supertest'
import express from 'express'
import { dailyRouter } from './daily.js'

const app = express()
app.use(express.json())
app.use('/api', dailyRouter)

// Mock environment variables
beforeEach(() => {
  process.env.VAULT_DIR = '/mock/vault'
  process.env.PROJECTS_DIR = '/mock/projects'
})

afterEach(() => {
  vi.clearAllMocks()
})

describe('GET /api/daily-context', () => {
  it('should return daily context with all fields', async () => {
    const res = await request(app).get('/api/daily-context')

    expect(res.status).toBe(200)
    expect(res.body).toHaveProperty('date')
    expect(res.body).toHaveProperty('deadlines')
    expect(res.body).toHaveProperty('calendarEvents')
    expect(res.body).toHaveProperty('staleProjects')
    expect(res.body).toHaveProperty('randomNotes')
    expect(res.body).toHaveProperty('gitActivity')

    // Verify types
    expect(typeof res.body.date).toBe('string')
    expect(Array.isArray(res.body.deadlines)).toBe(true)
    expect(Array.isArray(res.body.calendarEvents)).toBe(true)
    expect(Array.isArray(res.body.staleProjects)).toBe(true)
    expect(Array.isArray(res.body.randomNotes)).toBe(true)
    expect(typeof res.body.gitActivity).toBe('object')
  }, 15000) // googleapis dynamic import is slow on first load — rest of suite is fast

  it('should gracefully handle missing calendar data', async () => {
    const res = await request(app).get('/api/daily-context')

    expect(res.status).toBe(200)
    // Calendar events should be empty array if not configured
    expect(Array.isArray(res.body.calendarEvents)).toBe(true)
  })

  it('should gracefully handle missing git data', async () => {
    const res = await request(app).get('/api/daily-context')

    expect(res.status).toBe(200)
    expect(res.body.gitActivity).toHaveProperty('commitsToday')
    expect(res.body.gitActivity).toHaveProperty('commitsThisWeek')
    expect(typeof res.body.gitActivity.commitsToday).toBe('number')
    expect(typeof res.body.gitActivity.commitsThisWeek).toBe('number')
  })

  it('should return random notes with title, path, and preview', async () => {
    const res = await request(app).get('/api/daily-context')

    expect(res.status).toBe(200)
    expect(Array.isArray(res.body.randomNotes)).toBe(true)

    // Each random note should have required fields
    for (const note of res.body.randomNotes) {
      expect(note).toHaveProperty('title')
      expect(note).toHaveProperty('path')
      expect(note).toHaveProperty('preview')
      expect(typeof note.title).toBe('string')
      expect(typeof note.path).toBe('string')
      expect(typeof note.preview).toBe('string')
    }
  })

  it('should return at most 3 random notes', async () => {
    const res = await request(app).get('/api/daily-context')

    expect(res.status).toBe(200)
    expect(res.body.randomNotes.length).toBeLessThanOrEqual(3)
  })

  it('should return at most 3 stale projects', async () => {
    const res = await request(app).get('/api/daily-context')

    expect(res.status).toBe(200)
    expect(res.body.staleProjects.length).toBeLessThanOrEqual(3)
  })

  it('should format date as readable string', async () => {
    const res = await request(app).get('/api/daily-context')

    expect(res.status).toBe(200)
    // Date should be formatted like "Wednesday, April 16, 2026"
    expect(res.body.date).toMatch(/^[A-Z][a-z]+, [A-Z][a-z]+ \d{1,2}, \d{4}$/)
  })

  it('should return deadlines for today + next 3 days', async () => {
    const res = await request(app).get('/api/daily-context')

    expect(res.status).toBe(200)
    expect(Array.isArray(res.body.deadlines)).toBe(true)

    // All deadlines should be within 3 days
    const now = new Date()
    const threeDaysLater = new Date(now)
    threeDaysLater.setDate(threeDaysLater.getDate() + 3)
    const maxDate = threeDaysLater.toISOString().substring(0, 10)

    for (const deadline of res.body.deadlines) {
      expect(deadline.date <= maxDate).toBe(true)
      expect(deadline.done).toBe(false)
    }
  })
})
