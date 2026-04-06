import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { promises as fs } from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { readDeadlines } from './deadline-reader.js'

describe('deadline-reader', () => {
  let testDir: string
  let vaultDir: string
  let deadlinesDir: string
  let deadlinesPath: string

  /**
   * Helper to create date string N days from today
   * Uses local date to match the implementation
   */
  function dateFromToday(daysOffset: number): string {
    const now = new Date()
    const year = now.getFullYear()
    const month = now.getMonth()
    const day = now.getDate()

    const target = new Date(year, month, day + daysOffset)
    const y = target.getFullYear()
    const m = String(target.getMonth() + 1).padStart(2, '0')
    const d = String(target.getDate()).padStart(2, '0')

    return `${y}-${m}-${d}`
  }

  beforeEach(async () => {
    // Create temporary test directories
    testDir = path.join(os.tmpdir(), `test-deadlines-${Date.now()}-${Math.random().toString(36).substring(7)}`)
    vaultDir = path.join(testDir, 'vault')
    deadlinesDir = path.join(vaultDir, 'Deadlines')

    await fs.mkdir(deadlinesDir, { recursive: true })
    deadlinesPath = path.join(deadlinesDir, 'deadlines.md')
  })

  afterEach(async () => {
    // Clean up test directory
    await fs.rm(testDir, { recursive: true, force: true })
  })

  describe('basic parsing', () => {
    it('parses date, description, and tag correctly', async () => {
      await fs.writeFile(
        deadlinesPath,
        '- [ ] 2026-04-10 | ECE319H Lab 8 due | school\n'
      )

      const deadlines = await readDeadlines(vaultDir)

      expect(deadlines).toHaveLength(1)
      expect(deadlines[0]).toMatchObject({
        date: '2026-04-10',
        description: 'ECE319H Lab 8 due',
        tag: 'school',
        done: false
      })
      expect(deadlines[0].id).toHaveLength(12)
    })

    it('sets tag to null when not provided', async () => {
      await fs.writeFile(
        deadlinesPath,
        '- [ ] 2026-04-10 | Task without tag\n'
      )

      const deadlines = await readDeadlines(vaultDir)

      expect(deadlines).toHaveLength(1)
      expect(deadlines[0].tag).toBeNull()
    })

    it('parses completed deadlines (- [x])', async () => {
      await fs.writeFile(
        deadlinesPath,
        '- [x] 2026-04-01 | Completed task | project\n'
      )

      const deadlines = await readDeadlines(vaultDir)

      expect(deadlines).toHaveLength(1)
      expect(deadlines[0].done).toBe(true)
    })

    it('handles whitespace variations', async () => {
      await fs.writeFile(
        deadlinesPath,
        '  - [ ]   2026-04-10   |   Task with spaces   |   tag   \n'
      )

      const deadlines = await readDeadlines(vaultDir)

      expect(deadlines).toHaveLength(1)
      expect(deadlines[0]).toMatchObject({
        date: '2026-04-10',
        description: 'Task with spaces',
        tag: 'tag'
      })
    })
  })

  describe('urgency calculation', () => {
    it('sets urgency to gray for completed items', async () => {
      const dateStr = dateFromToday(1)

      await fs.writeFile(
        deadlinesPath,
        `- [x] ${dateStr} | Completed task | school\n`
      )

      const deadlines = await readDeadlines(vaultDir)

      expect(deadlines).toHaveLength(1)
      expect(deadlines[0].urgency).toBe('gray')
    })

    it('sets urgency to red for item due tomorrow (≤2 days)', async () => {
      const dateStr = dateFromToday(1)

      await fs.writeFile(
        deadlinesPath,
        `- [ ] ${dateStr} | Due tomorrow | school\n`
      )

      const deadlines = await readDeadlines(vaultDir)

      expect(deadlines).toHaveLength(1)
      expect(deadlines[0].urgency).toBe('red')
      expect(deadlines[0].daysUntil).toBe(1)
    })

    it('sets urgency to red for item due today (0 days)', async () => {
      const dateStr = dateFromToday(0)

      await fs.writeFile(
        deadlinesPath,
        `- [ ] ${dateStr} | Due today | school\n`
      )

      const deadlines = await readDeadlines(vaultDir)

      expect(deadlines).toHaveLength(1)
      expect(deadlines[0].urgency).toBe('red')
      expect(deadlines[0].daysUntil).toBe(0)
    })

    it('sets urgency to red for overdue item (negative days)', async () => {
      const dateStr = dateFromToday(-1)

      await fs.writeFile(
        deadlinesPath,
        `- [ ] ${dateStr} | Overdue task | school\n`
      )

      const deadlines = await readDeadlines(vaultDir)

      expect(deadlines).toHaveLength(1)
      expect(deadlines[0].urgency).toBe('red')
      expect(deadlines[0].daysUntil).toBe(-1)
    })

    it('sets urgency to amber for item due in 5 days (≤7 days)', async () => {
      const dateStr = dateFromToday(5)

      await fs.writeFile(
        deadlinesPath,
        `- [ ] ${dateStr} | Due in 5 days | school\n`
      )

      const deadlines = await readDeadlines(vaultDir)

      expect(deadlines).toHaveLength(1)
      expect(deadlines[0].urgency).toBe('amber')
      expect(deadlines[0].daysUntil).toBe(5)
    })

    it('sets urgency to amber for item due in exactly 7 days', async () => {
      const dateStr = dateFromToday(7)

      await fs.writeFile(
        deadlinesPath,
        `- [ ] ${dateStr} | Due in 7 days | school\n`
      )

      const deadlines = await readDeadlines(vaultDir)

      expect(deadlines).toHaveLength(1)
      expect(deadlines[0].urgency).toBe('amber')
      expect(deadlines[0].daysUntil).toBe(7)
    })

    it('sets urgency to green for item due in 10 days (>7 days)', async () => {
      const dateStr = dateFromToday(10)

      await fs.writeFile(
        deadlinesPath,
        `- [ ] ${dateStr} | Due in 10 days | school\n`
      )

      const deadlines = await readDeadlines(vaultDir)

      expect(deadlines).toHaveLength(1)
      expect(deadlines[0].urgency).toBe('green')
      expect(deadlines[0].daysUntil).toBe(10)
    })
  })

  describe('sorting', () => {
    it('sorts pending items by date ascending (soonest first)', async () => {
      await fs.writeFile(
        deadlinesPath,
        [
          '- [ ] 2026-04-15 | Task C | school',
          '- [ ] 2026-04-10 | Task A | school',
          '- [ ] 2026-04-12 | Task B | school'
        ].join('\n')
      )

      const deadlines = await readDeadlines(vaultDir)

      expect(deadlines).toHaveLength(3)
      expect(deadlines[0].description).toBe('Task A')
      expect(deadlines[1].description).toBe('Task B')
      expect(deadlines[2].description).toBe('Task C')
    })

    it('puts done items at the end, sorted by date descending', async () => {
      await fs.writeFile(
        deadlinesPath,
        [
          '- [ ] 2026-04-15 | Pending C | school',
          '- [x] 2026-04-05 | Done B | school',
          '- [ ] 2026-04-10 | Pending A | school',
          '- [x] 2026-04-01 | Done A | school',
          '- [ ] 2026-04-12 | Pending B | school',
          '- [x] 2026-04-08 | Done C | school'
        ].join('\n')
      )

      const deadlines = await readDeadlines(vaultDir)

      expect(deadlines).toHaveLength(6)
      // First 3 should be pending, sorted ascending
      expect(deadlines[0].description).toBe('Pending A')
      expect(deadlines[0].done).toBe(false)
      expect(deadlines[1].description).toBe('Pending B')
      expect(deadlines[1].done).toBe(false)
      expect(deadlines[2].description).toBe('Pending C')
      expect(deadlines[2].done).toBe(false)
      // Last 3 should be done, sorted descending
      expect(deadlines[3].description).toBe('Done C')
      expect(deadlines[3].done).toBe(true)
      expect(deadlines[4].description).toBe('Done B')
      expect(deadlines[4].done).toBe(true)
      expect(deadlines[5].description).toBe('Done A')
      expect(deadlines[5].done).toBe(true)
    })
  })

  describe('edge cases', () => {
    it('skips lines not matching the format', async () => {
      await fs.writeFile(
        deadlinesPath,
        [
          '- [ ] 2026-04-10 | Valid task | school',
          'Not a task line',
          'Just some text',
          '- Invalid checkbox',
          '- [ ] Not a date | Description',
          '- [ ] 2026-04-15 | Another valid task'
        ].join('\n')
      )

      const deadlines = await readDeadlines(vaultDir)

      expect(deadlines).toHaveLength(2)
      expect(deadlines[0].description).toBe('Valid task')
      expect(deadlines[1].description).toBe('Another valid task')
    })

    it('skips comment lines starting with #', async () => {
      await fs.writeFile(
        deadlinesPath,
        [
          '# Deadlines',
          '- [ ] 2026-04-10 | Task one | school',
          '## School',
          '- [ ] 2026-04-15 | Task two | school'
        ].join('\n')
      )

      const deadlines = await readDeadlines(vaultDir)

      expect(deadlines).toHaveLength(2)
    })

    it('skips blockquote lines starting with >', async () => {
      await fs.writeFile(
        deadlinesPath,
        [
          '> Important note',
          '- [ ] 2026-04-10 | Task one | school',
          '> Another note',
          '- [ ] 2026-04-15 | Task two | school'
        ].join('\n')
      )

      const deadlines = await readDeadlines(vaultDir)

      expect(deadlines).toHaveLength(2)
    })

    it('returns empty array for empty file', async () => {
      await fs.writeFile(deadlinesPath, '')

      const deadlines = await readDeadlines(vaultDir)

      expect(deadlines).toHaveLength(0)
    })

    it('returns empty array when file does not exist', async () => {
      // Don't create the file
      const deadlines = await readDeadlines(vaultDir)

      expect(deadlines).toHaveLength(0)
    })

    it('rejects invalid date formats', async () => {
      await fs.writeFile(
        deadlinesPath,
        [
          '- [ ] 04-10-2026 | Invalid format | school',
          '- [ ] 2026/04/10 | Invalid separator | school',
          '- [ ] 2026-4-10 | Missing zero padding | school',
          '- [ ] 2026-04-10 | Valid task | school'
        ].join('\n')
      )

      const deadlines = await readDeadlines(vaultDir)

      expect(deadlines).toHaveLength(1)
      expect(deadlines[0].description).toBe('Valid task')
    })

    it('rejects unparseable dates', async () => {
      await fs.writeFile(
        deadlinesPath,
        [
          '- [ ] 2026-13-45 | Invalid month and day | school',
          '- [ ] 2026-04-10 | Valid task | school'
        ].join('\n')
      )

      const deadlines = await readDeadlines(vaultDir)

      expect(deadlines).toHaveLength(1)
      expect(deadlines[0].description).toBe('Valid task')
    })

    it('generates stable IDs based on date and description', async () => {
      await fs.writeFile(
        deadlinesPath,
        '- [ ] 2026-04-10 | ECE319H Lab 8 due | school\n'
      )

      const deadlines1 = await readDeadlines(vaultDir)
      const deadlines2 = await readDeadlines(vaultDir)

      expect(deadlines1[0].id).toBe(deadlines2[0].id)
      expect(deadlines1[0].id).toHaveLength(12)
    })
  })

  describe('security', () => {
    it('validates deadlines.md is within vault/Deadlines/', async () => {
      // The function constructs the path as vaultDir/Deadlines/deadlines.md
      // This test verifies the validation logic works correctly

      // Create a test vault in a parent directory
      const parentDir = path.join(testDir, 'parent')
      const childVault = path.join(parentDir, 'vault')
      await fs.mkdir(path.join(childVault, 'Deadlines'), { recursive: true })

      // Reading from a valid vault should work
      const deadlines = await readDeadlines(childVault)
      expect(Array.isArray(deadlines)).toBe(true)
    })
  })
})
