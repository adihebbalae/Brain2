import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { promises as fs } from 'node:fs'
import path from 'node:path'
import { loadReviewLog, saveReviewLog, markReviewed, syncNewNotes } from './review-log.js'

describe('review-log', () => {
  let tempDir: string

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(process.cwd(), 'test-review-log-'))
  })

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true })
  })

  describe('loadReviewLog', () => {
    it('should return empty object when file does not exist', async () => {
      const log = await loadReviewLog(tempDir)
      expect(log).toEqual({})
    })

    it('should load valid review log from disk', async () => {
      const resourcesDir = path.join(tempDir, 'Resources')
      await fs.mkdir(resourcesDir, { recursive: true })
      const logPath = path.join(resourcesDir, 'review-log.json')
      const logData = {
        'notes/MyNote.md': '2026-03-10T09:00:00.000Z',
        'Projects/ProjectX.md': null
      }
      await fs.writeFile(logPath, JSON.stringify(logData), 'utf-8')

      const log = await loadReviewLog(tempDir)
      expect(log).toEqual(logData)
    })

    it('should return empty object for invalid JSON', async () => {
      const resourcesDir = path.join(tempDir, 'Resources')
      await fs.mkdir(resourcesDir, { recursive: true })
      const logPath = path.join(resourcesDir, 'review-log.json')
      await fs.writeFile(logPath, 'not json', 'utf-8')

      const log = await loadReviewLog(tempDir)
      expect(log).toEqual({})
    })

    it('should return empty object for non-object JSON', async () => {
      const resourcesDir = path.join(tempDir, 'Resources')
      await fs.mkdir(resourcesDir, { recursive: true })
      const logPath = path.join(resourcesDir, 'review-log.json')
      await fs.writeFile(logPath, JSON.stringify(['array']), 'utf-8')

      const log = await loadReviewLog(tempDir)
      expect(log).toEqual({})
    })
  })

  describe('saveReviewLog', () => {
    it('should create Resources directory if it does not exist', async () => {
      const logData = { 'notes/MyNote.md': null }
      await saveReviewLog(tempDir, logData)

      const resourcesDir = path.join(tempDir, 'Resources')
      const stat = await fs.stat(resourcesDir)
      expect(stat.isDirectory()).toBe(true)
    })

    it('should save review log to disk', async () => {
      const logData = {
        'notes/MyNote.md': '2026-03-10T09:00:00.000Z',
        'Projects/ProjectX.md': null
      }
      await saveReviewLog(tempDir, logData)

      const logPath = path.join(tempDir, 'Resources', 'review-log.json')
      const content = await fs.readFile(logPath, 'utf-8')
      const parsed = JSON.parse(content)
      expect(parsed).toEqual(logData)
    })

    it('should overwrite existing log file', async () => {
      const logData1 = { 'notes/Note1.md': null }
      await saveReviewLog(tempDir, logData1)

      const logData2 = { 'notes/Note2.md': '2026-04-10T09:00:00.000Z' }
      await saveReviewLog(tempDir, logData2)

      const log = await loadReviewLog(tempDir)
      expect(log).toEqual(logData2)
    })
  })

  describe('markReviewed', () => {
    it('should mark a note as reviewed with current timestamp', async () => {
      // Create initial log
      const logData = {
        'notes/MyNote.md': null,
        'Projects/ProjectX.md': null
      }
      await saveReviewLog(tempDir, logData)

      const beforeMark = new Date()
      await markReviewed(tempDir, 'notes/MyNote.md')
      const afterMark = new Date()

      const log = await loadReviewLog(tempDir)
      expect(log['notes/MyNote.md']).not.toBeNull()

      const timestamp = new Date(log['notes/MyNote.md'] as string)
      expect(timestamp.getTime()).toBeGreaterThanOrEqual(beforeMark.getTime())
      expect(timestamp.getTime()).toBeLessThanOrEqual(afterMark.getTime())

      // Other note should remain unchanged
      expect(log['Projects/ProjectX.md']).toBeNull()
    })

    it('should update existing timestamp', async () => {
      const logData = {
        'notes/MyNote.md': '2020-01-01T00:00:00.000Z'
      }
      await saveReviewLog(tempDir, logData)

      await markReviewed(tempDir, 'notes/MyNote.md')

      const log = await loadReviewLog(tempDir)
      const timestamp = new Date(log['notes/MyNote.md'] as string)
      const now = new Date()

      // Should be recent (within last 10 seconds)
      expect(now.getTime() - timestamp.getTime()).toBeLessThan(10_000)
    })

    it('should add new entry if note not in log', async () => {
      await saveReviewLog(tempDir, {})

      await markReviewed(tempDir, 'notes/NewNote.md')

      const log = await loadReviewLog(tempDir)
      expect(log['notes/NewNote.md']).not.toBeNull()
    })
  })

  describe('syncNewNotes', () => {
    it('should add new vault notes to log', async () => {
      // Create some markdown files
      const notesDir = path.join(tempDir, 'notes')
      await fs.mkdir(notesDir, { recursive: true })
      await fs.writeFile(path.join(notesDir, 'Note1.md'), '# Note 1', 'utf-8')
      await fs.writeFile(path.join(notesDir, 'Note2.md'), '# Note 2', 'utf-8')

      await syncNewNotes(tempDir)

      const log = await loadReviewLog(tempDir)
      expect(log['notes/Note1.md']).toBeNull()
      expect(log['notes/Note2.md']).toBeNull()
    })

    it('should exclude DailyNotes directory', async () => {
      const dailyNotesDir = path.join(tempDir, 'DailyNotes')
      await fs.mkdir(dailyNotesDir, { recursive: true })
      await fs.writeFile(path.join(dailyNotesDir, '2026-04-10.md'), '# Daily note', 'utf-8')

      await syncNewNotes(tempDir)

      const log = await loadReviewLog(tempDir)
      expect(log['DailyNotes/2026-04-10.md']).toBeUndefined()
    })

    it('should exclude Resources directory', async () => {
      const resourcesDir = path.join(tempDir, 'Resources')
      await fs.mkdir(resourcesDir, { recursive: true })
      await fs.writeFile(path.join(resourcesDir, 'resource.md'), '# Resource', 'utf-8')

      await syncNewNotes(tempDir)

      const log = await loadReviewLog(tempDir)
      expect(log['Resources/resource.md']).toBeUndefined()
    })

    it('should not overwrite existing entries', async () => {
      // Create initial log with one reviewed note
      const logData = {
        'notes/ExistingNote.md': '2026-03-10T09:00:00.000Z'
      }
      await saveReviewLog(tempDir, logData)

      // Create the existing note and a new note
      const notesDir = path.join(tempDir, 'notes')
      await fs.mkdir(notesDir, { recursive: true })
      await fs.writeFile(path.join(notesDir, 'ExistingNote.md'), '# Existing', 'utf-8')
      await fs.writeFile(path.join(notesDir, 'NewNote.md'), '# New', 'utf-8')

      await syncNewNotes(tempDir)

      const log = await loadReviewLog(tempDir)
      // Existing note timestamp should be preserved
      expect(log['notes/ExistingNote.md']).toBe('2026-03-10T09:00:00.000Z')
      // New note should be added with null
      expect(log['notes/NewNote.md']).toBeNull()
    })

    it('should handle empty vault', async () => {
      await syncNewNotes(tempDir)

      const log = await loadReviewLog(tempDir)
      expect(log).toEqual({})
    })

    it('should handle nested directories', async () => {
      const nestedDir = path.join(tempDir, 'Projects', 'SubProject')
      await fs.mkdir(nestedDir, { recursive: true })
      await fs.writeFile(path.join(nestedDir, 'NestedNote.md'), '# Nested', 'utf-8')

      await syncNewNotes(tempDir)

      const log = await loadReviewLog(tempDir)
      expect(log['Projects/SubProject/NestedNote.md']).toBeNull()
    })
  })
})
