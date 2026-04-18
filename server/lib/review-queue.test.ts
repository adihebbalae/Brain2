import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { promises as fs } from 'node:fs'
import path from 'node:path'
import { getReviewQueue, getRandomNote } from './review-queue.js'
import { saveReviewLog } from './review-log.js'

describe('review-queue', () => {
  let tempDir: string

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(process.cwd(), 'test-review-queue-'))
  })

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true })
  })

  async function createNote(relativePath: string, content: string) {
    const absPath = path.join(tempDir, relativePath)
    await fs.mkdir(path.dirname(absPath), { recursive: true })
    await fs.writeFile(absPath, content, 'utf-8')
  }

  describe('getReviewQueue', () => {
    it('should return empty queue when log is empty', async () => {
      await saveReviewLog(tempDir, {})

      const queue = await getReviewQueue(tempDir, 10)
      expect(queue).toEqual([])
    })

    it('should exclude notes reviewed within 30 days (current status)', async () => {
      const recentDate = new Date()
      recentDate.setDate(recentDate.getDate() - 15) // 15 days ago

      const logData = {
        'notes/RecentNote.md': recentDate.toISOString(),
        'notes/OldNote.md': null
      }
      await saveReviewLog(tempDir, logData)
      await createNote('notes/RecentNote.md', '# Recent')
      await createNote('notes/OldNote.md', '# Old')

      const queue = await getReviewQueue(tempDir, 10)

      // Only the never-reviewed note should be in queue
      expect(queue.length).toBe(1)
      expect(queue[0].relativePath).toBe('notes/OldNote.md')
      expect(queue[0].status).toBe('never_reviewed')
    })

    it('should prioritize never_reviewed notes first', async () => {
      const date90 = new Date()
      date90.setDate(date90.getDate() - 95)

      const logData = {
        'notes/NeverReviewed.md': null,
        'notes/Overdue90d.md': date90.toISOString()
      }
      await saveReviewLog(tempDir, logData)
      await createNote('notes/NeverReviewed.md', '# Never')
      await createNote('notes/Overdue90d.md', '# Overdue 90')

      const queue = await getReviewQueue(tempDir, 10)

      expect(queue.length).toBe(2)
      expect(queue[0].status).toBe('never_reviewed')
      expect(queue[1].status).toBe('overdue_90d')
    })

    it('should correctly classify overdue statuses', async () => {
      const date30 = new Date()
      date30.setDate(date30.getDate() - 35)

      const date60 = new Date()
      date60.setDate(date60.getDate() - 65)

      const date90 = new Date()
      date90.setDate(date90.getDate() - 95)

      const logData = {
        'notes/Overdue30d.md': date30.toISOString(),
        'notes/Overdue60d.md': date60.toISOString(),
        'notes/Overdue90d.md': date90.toISOString()
      }
      await saveReviewLog(tempDir, logData)
      await createNote('notes/Overdue30d.md', '# 30d')
      await createNote('notes/Overdue60d.md', '# 60d')
      await createNote('notes/Overdue90d.md', '# 90d')

      const queue = await getReviewQueue(tempDir, 10)

      expect(queue.length).toBe(3)

      // Should be sorted by status (90d > 60d > 30d)
      expect(queue[0].status).toBe('overdue_90d')
      expect(queue[1].status).toBe('overdue_60d')
      expect(queue[2].status).toBe('overdue_30d')
    })

    it('should sort by daysSince descending within same status bucket', async () => {
      const date1 = new Date()
      date1.setDate(date1.getDate() - 100) // More overdue

      const date2 = new Date()
      date2.setDate(date2.getDate() - 95) // Less overdue

      const logData = {
        'notes/MoreOverdue.md': date1.toISOString(),
        'notes/LessOverdue.md': date2.toISOString()
      }
      await saveReviewLog(tempDir, logData)
      await createNote('notes/MoreOverdue.md', '# More')
      await createNote('notes/LessOverdue.md', '# Less')

      const queue = await getReviewQueue(tempDir, 10)

      expect(queue.length).toBe(2)
      // Both are overdue_90d, so should be sorted by daysSince descending
      expect(queue[0].relativePath).toBe('notes/MoreOverdue.md')
      expect(queue[0].daysSince).toBeGreaterThan(queue[1].daysSince!)
    })

    it('should respect maxItems limit', async () => {
      const logData: Record<string, null> = {}
      for (let i = 1; i <= 20; i++) {
        logData[`notes/Note${i}.md`] = null
        await createNote(`notes/Note${i}.md`, `# Note ${i}`)
      }
      await saveReviewLog(tempDir, logData)

      const queue = await getReviewQueue(tempDir, 5)
      expect(queue.length).toBe(5)
    })

    it('should extract title from filename', async () => {
      const logData = {
        'notes/My Great Note.md': null
      }
      await saveReviewLog(tempDir, logData)
      await createNote('notes/My Great Note.md', '# Content')

      const queue = await getReviewQueue(tempDir, 10)

      expect(queue[0].title).toBe('My Great Note')
    })

    it('should extract preview from file content', async () => {
      const logData = {
        'notes/Note.md': null
      }
      await saveReviewLog(tempDir, logData)
      await createNote('notes/Note.md', 'This is the first 100 characters of the note content that should appear in the preview text.')

      const queue = await getReviewQueue(tempDir, 10)

      expect(queue[0].preview).toBe('This is the first 100 characters of the note content that should appear in the preview text.')
    })

    it('should strip YAML frontmatter from preview', async () => {
      const logData = {
        'notes/Note.md': null
      }
      await saveReviewLog(tempDir, logData)
      await createNote('notes/Note.md', '---\ntitle: My Note\ntags: [test]\n---\n\nThis is the actual content.')

      const queue = await getReviewQueue(tempDir, 10)

      expect(queue[0].preview).toBe('This is the actual content.')
    })

    it('should strip markdown formatting from preview', async () => {
      const logData = {
        'notes/Note.md': null
      }
      await saveReviewLog(tempDir, logData)
      await createNote('notes/Note.md', '# Heading\n\nThis is **bold** and *italic* text with a [link](url).')

      const queue = await getReviewQueue(tempDir, 10)

      expect(queue[0].preview).toContain('Heading')
      expect(queue[0].preview).toContain('This is bold and italic text with a link')
      expect(queue[0].preview).not.toContain('**')
      expect(queue[0].preview).not.toContain('*')
      expect(queue[0].preview).not.toContain('[')
    })

    it('should truncate preview to 100 characters', async () => {
      const logData = {
        'notes/Note.md': null
      }
      await saveReviewLog(tempDir, logData)
      const longContent = 'A'.repeat(200)
      await createNote('notes/Note.md', longContent)

      const queue = await getReviewQueue(tempDir, 10)

      expect(queue[0].preview.length).toBe(100)
    })

    it('should calculate daysSince correctly', async () => {
      const date = new Date()
      date.setDate(date.getDate() - 50)

      const logData = {
        'notes/Note.md': date.toISOString()
      }
      await saveReviewLog(tempDir, logData)
      await createNote('notes/Note.md', '# Content')

      const queue = await getReviewQueue(tempDir, 10)

      expect(queue[0].daysSince).toBeGreaterThanOrEqual(49)
      expect(queue[0].daysSince).toBeLessThanOrEqual(51)
    })

    it('should have null daysSince for never reviewed notes', async () => {
      const logData = {
        'notes/NeverReviewed.md': null
      }
      await saveReviewLog(tempDir, logData)
      await createNote('notes/NeverReviewed.md', '# Content')

      const queue = await getReviewQueue(tempDir, 10)

      expect(queue[0].daysSince).toBeNull()
    })
  })

  describe('getRandomNote', () => {
    it('should return null when log is empty', async () => {
      await saveReviewLog(tempDir, {})

      const note = await getRandomNote(tempDir)
      expect(note).toBeNull()
    })

    it('should return a note from the log', async () => {
      const logData = {
        'notes/Note1.md': null,
        'notes/Note2.md': null,
        'notes/Note3.md': null
      }
      await saveReviewLog(tempDir, logData)
      await createNote('notes/Note1.md', '# Note 1')
      await createNote('notes/Note2.md', '# Note 2')
      await createNote('notes/Note3.md', '# Note 3')

      const note = await getRandomNote(tempDir)

      expect(note).not.toBeNull()
      expect(['notes/Note1.md', 'notes/Note2.md', 'notes/Note3.md']).toContain(note!.relativePath)
    })

    it('should include notes with current status (not just overdue)', async () => {
      const recentDate = new Date()
      recentDate.setDate(recentDate.getDate() - 5) // Within 30 days

      const logData = {
        'notes/RecentNote.md': recentDate.toISOString()
      }
      await saveReviewLog(tempDir, logData)
      await createNote('notes/RecentNote.md', '# Recent')

      const note = await getRandomNote(tempDir)

      expect(note).not.toBeNull()
      expect(note!.status).toBe('current')
    })

    it('should return note with correct metadata', async () => {
      const logData = {
        'notes/My Note.md': null
      }
      await saveReviewLog(tempDir, logData)
      await createNote('notes/My Note.md', 'Content preview here')

      const note = await getRandomNote(tempDir)

      expect(note).not.toBeNull()
      expect(note!.relativePath).toBe('notes/My Note.md')
      expect(note!.title).toBe('My Note')
      expect(note!.preview).toBe('Content preview here')
      expect(note!.lastReviewed).toBeNull()
      expect(note!.status).toBe('never_reviewed')
      expect(note!.daysSince).toBeNull()
    })
  })
})
