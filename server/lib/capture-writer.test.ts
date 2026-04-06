import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { promises as fs } from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { appendCapture } from './capture-writer.js'

describe('Capture Writer', () => {
  let tempDir: string

  beforeEach(async () => {
    // Create a temporary directory for testing
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'cortex-capture-test-'))
  })

  afterEach(async () => {
    // Clean up temporary directory
    try {
      await fs.rm(tempDir, { recursive: true, force: true })
    } catch (error) {
      console.error('Failed to clean up temp dir:', error)
    }
  })

  describe('appendCapture', () => {
    it('should create inbox.md if it does not exist', async () => {
      const entry = await appendCapture('hello world', tempDir)

      const inboxPath = path.join(tempDir, 'Inbox', 'inbox.md')
      const exists = await fs.access(inboxPath).then(() => true).catch(() => false)

      expect(exists).toBe(true)
      expect(entry).toMatch(/^- \[ \] \[\d{4}-\d{2}-\d{2} \d{2}:\d{2}\] hello world$/)
    })

    it('should create Inbox directory if it does not exist', async () => {
      await appendCapture('test', tempDir)

      const inboxDirPath = path.join(tempDir, 'Inbox')
      const stats = await fs.stat(inboxDirPath)

      expect(stats.isDirectory()).toBe(true)
    })

    it('should format entry correctly with timestamp', async () => {
      const entry = await appendCapture('my task', tempDir)

      // Entry format: - [ ] [YYYY-MM-DD HH:mm] text
      expect(entry).toMatch(/^- \[ \] \[\d{4}-\d{2}-\d{2} \d{2}:\d{2}\] my task$/)
    })

    it('should append multiple entries to the same file', async () => {
      await appendCapture('first task', tempDir)
      await appendCapture('second task', tempDir)
      await appendCapture('third task', tempDir)

      const inboxPath = path.join(tempDir, 'Inbox', 'inbox.md')
      const content = await fs.readFile(inboxPath, 'utf-8')
      const lines = content.trim().split('\n')

      expect(lines).toHaveLength(3)
      expect(lines[0]).toContain('first task')
      expect(lines[1]).toContain('second task')
      expect(lines[2]).toContain('third task')
    })

    it('should not overwrite existing content', async () => {
      const inboxPath = path.join(tempDir, 'Inbox', 'inbox.md')
      await fs.mkdir(path.join(tempDir, 'Inbox'), { recursive: true })
      await fs.writeFile(inboxPath, '- [ ] existing task\n', 'utf-8')

      await appendCapture('new task', tempDir)

      const content = await fs.readFile(inboxPath, 'utf-8')
      const lines = content.trim().split('\n')

      expect(lines).toHaveLength(2)
      expect(lines[0]).toBe('- [ ] existing task')
      expect(lines[1]).toContain('new task')
    })

    it('should trim whitespace from text', async () => {
      const entry = await appendCapture('  spaced text  ', tempDir)

      expect(entry).toContain('spaced text')
      expect(entry).not.toContain('  spaced text  ')
    })

    it('should handle text with special characters', async () => {
      const entry = await appendCapture('task with @#$% special chars!', tempDir)

      expect(entry).toContain('task with @#$% special chars!')
    })

    it('should generate valid timestamp in current time', async () => {
      const before = new Date()
      const entry = await appendCapture('test', tempDir)
      const after = new Date()

      // Extract timestamp from entry
      const match = entry.match(/\[(\d{4}-\d{2}-\d{2} \d{2}:\d{2})\]/)
      expect(match).not.toBeNull()

      if (match) {
        const timestamp = match[1]
        const entryDate = new Date(timestamp.replace(' ', 'T') + ':00')

        // Timestamp should be between before and after
        expect(entryDate.getTime()).toBeGreaterThanOrEqual(before.getTime() - 60000) // Allow 1 min slack
        expect(entryDate.getTime()).toBeLessThanOrEqual(after.getTime() + 60000)
      }
    })

    it('should resolve relative vault paths', async () => {
      const relativePath = './test-vault'
      const fullPath = path.join(process.cwd(), relativePath)

      try {
        await appendCapture('test', relativePath)
        const inboxPath = path.join(fullPath, 'Inbox', 'inbox.md')
        const exists = await fs.access(inboxPath).then(() => true).catch(() => false)

        expect(exists).toBe(true)
      } finally {
        // Cleanup
        await fs.rm(fullPath, { recursive: true, force: true }).catch(() => {})
      }
    })
  })
})
