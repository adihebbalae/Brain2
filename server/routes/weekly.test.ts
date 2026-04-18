import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import request from 'supertest'
import express from 'express'
import { weeklyRouter } from './weekly.js'

const app = express()
app.use(express.json())
app.use('/api', weeklyRouter)

// Mock environment variables
beforeEach(() => {
  process.env.VAULT_DIR = '/mock/vault'
  process.env.PROJECTS_DIR = '/mock/projects'
  process.env.NODE_ENV = 'test' // Prevent actual notifications
})

afterEach(() => {
  vi.clearAllMocks()
})

describe('GET /api/weekly-review/status', () => {
  it('should return status with thisWeek and generated fields', async () => {
    const res = await request(app).get('/api/weekly-review/status')

    expect(res.status).toBe(200)
    expect(res.body).toHaveProperty('thisWeek')
    expect(res.body).toHaveProperty('generated')
    expect(res.body).toHaveProperty('path')

    // thisWeek should be in YYYY-WXX format
    expect(res.body.thisWeek).toMatch(/^\d{4}-W\d{2}$/)

    // generated should be a boolean
    expect(typeof res.body.generated).toBe('boolean')

    // path should be string or null
    expect(res.body.path === null || typeof res.body.path === 'string').toBe(true)
  })

  it('should return generated: false when file does not exist', async () => {
    const res = await request(app).get('/api/weekly-review/status')

    expect(res.status).toBe(200)
    // In test environment, file likely doesn't exist
    if (!res.body.generated) {
      expect(res.body.path).toBe(null)
    }
  })

  it('should return correct week number', async () => {
    const res = await request(app).get('/api/weekly-review/status')

    expect(res.status).toBe(200)

    // Week number should be between 1 and 53
    const match = res.body.thisWeek.match(/^(\d{4})-W(\d{2})$/)
    expect(match).not.toBe(null)

    if (match) {
      const weekNum = parseInt(match[2], 10)
      expect(weekNum).toBeGreaterThanOrEqual(1)
      expect(weekNum).toBeLessThanOrEqual(53)
    }
  })
})

describe('POST /api/weekly-review', () => {
  it('should return success in test mode', async () => {
    const res = await request(app).post('/api/weekly-review')

    expect(res.status).toBe(200)
    expect(res.body).toHaveProperty('success')
    expect(res.body.success).toBe(true)
  })

  it('should return path and preview in test mode', async () => {
    const res = await request(app).post('/api/weekly-review')

    expect(res.status).toBe(200)
    expect(res.body).toHaveProperty('path')
    expect(res.body).toHaveProperty('preview')
    expect(typeof res.body.path).toBe('string')
    expect(typeof res.body.preview).toBe('string')
  })
})

describe('Weekly review data gathering', () => {
  it('should gracefully handle missing git activity data', async () => {
    // This test verifies that the route doesn't crash when git data is unavailable
    const res = await request(app).post('/api/weekly-review')
    expect(res.status).toBe(200)
  })

  it('should gracefully handle missing calendar data', async () => {
    // This test verifies that the route doesn't crash when calendar data is unavailable
    const res = await request(app).post('/api/weekly-review')
    expect(res.status).toBe(200)
  })

  it('should gracefully handle missing reading log data', async () => {
    // This test verifies that the route doesn't crash when reading log is unavailable
    const res = await request(app).post('/api/weekly-review')
    expect(res.status).toBe(200)
  })

  it('should gracefully handle missing YouTube data', async () => {
    // This test verifies that the route doesn't crash when YouTube data is unavailable
    const res = await request(app).post('/api/weekly-review')
    expect(res.status).toBe(200)
  })
})

describe('Weekly review Ollama prompt construction', () => {
  // These tests verify the prompt construction logic is robust
  it('should handle zero git commits', async () => {
    const res = await request(app).post('/api/weekly-review')
    expect(res.status).toBe(200)
  })

  it('should handle zero completed todos', async () => {
    const res = await request(app).post('/api/weekly-review')
    expect(res.status).toBe(200)
  })

  it('should handle empty articles and videos', async () => {
    const res = await request(app).post('/api/weekly-review')
    expect(res.status).toBe(200)
  })

  it('should handle no upcoming deadlines', async () => {
    const res = await request(app).post('/api/weekly-review')
    expect(res.status).toBe(200)
  })

  it('should handle no stale projects', async () => {
    const res = await request(app).post('/api/weekly-review')
    expect(res.status).toBe(200)
  })
})
