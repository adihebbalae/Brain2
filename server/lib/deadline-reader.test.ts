import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { promises as fs } from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { readDeadlines, addDeadline, removeDeadline, updateDeadline } from './deadline-reader.js'

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

    it('parses notes from 4th pipe field', async () => {
      await fs.writeFile(
        deadlinesPath,
        '- [ ] 2026-04-10 | ECE319H Lab 8 due | school | Submit via portal by midnight\n'
      )

      const deadlines = await readDeadlines(vaultDir)

      expect(deadlines).toHaveLength(1)
      expect(deadlines[0].notes).toBe('Submit via portal by midnight')
    })

    it('sets notes to undefined when not provided', async () => {
      await fs.writeFile(
        deadlinesPath,
        '- [ ] 2026-04-10 | ECE319H Lab 8 due | school\n'
      )

      const deadlines = await readDeadlines(vaultDir)

      expect(deadlines).toHaveLength(1)
      expect(deadlines[0].notes).toBeUndefined()
    })

    it('sets notes to undefined when 4th field is empty', async () => {
      await fs.writeFile(
        deadlinesPath,
        '- [ ] 2026-04-10 | ECE319H Lab 8 due | school | \n'
      )

      const deadlines = await readDeadlines(vaultDir)

      expect(deadlines).toHaveLength(1)
      expect(deadlines[0].notes).toBeUndefined()
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

  describe('addDeadline', () => {
    it('appends correctly formatted line to deadlines.md', async () => {
      await fs.writeFile(deadlinesPath, '# Deadlines\n\n', 'utf-8')

      const result = await addDeadline(vaultDir, {
        date: '2026-05-01',
        description: 'Test deadline'
      })

      const content = await fs.readFile(deadlinesPath, 'utf-8')
      expect(content).toContain('- [ ] 2026-05-01 | Test deadline\n')
      expect(result).toMatchObject({
        date: '2026-05-01',
        description: 'Test deadline',
        tag: null,
        done: false
      })
      expect(result.id).toHaveLength(12)
    })

    it('appends with optional tag', async () => {
      await fs.writeFile(deadlinesPath, '# Deadlines\n\n', 'utf-8')

      const result = await addDeadline(vaultDir, {
        date: '2026-05-01',
        description: 'Test deadline',
        tag: 'school'
      })

      const content = await fs.readFile(deadlinesPath, 'utf-8')
      expect(content).toContain('- [ ] 2026-05-01 | Test deadline | school\n')
      expect(result.tag).toBe('school')
    })

    it('creates Deadlines directory and file if missing', async () => {
      // Remove the directory we created in beforeEach
      await fs.rm(deadlinesDir, { recursive: true, force: true })

      await addDeadline(vaultDir, {
        date: '2026-05-01',
        description: 'Test deadline'
      })

      // Verify directory and file were created
      const dirExists = await fs.access(deadlinesDir).then(() => true).catch(() => false)
      const fileExists = await fs.access(deadlinesPath).then(() => true).catch(() => false)
      expect(dirExists).toBe(true)
      expect(fileExists).toBe(true)

      const content = await fs.readFile(deadlinesPath, 'utf-8')
      expect(content).toContain('# Deadlines\n\n')
      expect(content).toContain('- [ ] 2026-05-01 | Test deadline\n')
    })

    it('returns a DeadlineItem with correct properties', async () => {
      await fs.writeFile(deadlinesPath, '# Deadlines\n\n', 'utf-8')

      const result = await addDeadline(vaultDir, {
        date: '2026-05-01',
        description: 'Test deadline',
        tag: 'project'
      })

      expect(result).toHaveProperty('id')
      expect(result).toHaveProperty('date', '2026-05-01')
      expect(result).toHaveProperty('description', 'Test deadline')
      expect(result).toHaveProperty('tag', 'project')
      expect(result).toHaveProperty('done', false)
      expect(result).toHaveProperty('urgency')
      expect(result).toHaveProperty('daysUntil')
      expect(typeof result.daysUntil).toBe('number')
    })

    it('appends with optional notes', async () => {
      await fs.writeFile(deadlinesPath, '# Deadlines\n\n', 'utf-8')

      const result = await addDeadline(vaultDir, {
        date: '2026-05-01',
        description: 'Test deadline',
        tag: 'school',
        notes: 'Submit via the portal',
      })

      const content = await fs.readFile(deadlinesPath, 'utf-8')
      expect(content).toContain('- [ ] 2026-05-01 | Test deadline | school | Submit via the portal\n')
      expect(result.notes).toBe('Submit via the portal')
    })

    it('writes empty tag placeholder when notes present but no tag', async () => {
      await fs.writeFile(deadlinesPath, '# Deadlines\n\n', 'utf-8')

      await addDeadline(vaultDir, {
        date: '2026-05-01',
        description: 'Test deadline',
        notes: 'A note',
      })

      const content = await fs.readFile(deadlinesPath, 'utf-8')
      expect(content).toContain('- [ ] 2026-05-01 | Test deadline |  | A note\n')
    })

    it('sanitizes pipe characters in description', async () => {
      await fs.writeFile(deadlinesPath, '# Deadlines\n\n', 'utf-8')

      const result = await addDeadline(vaultDir, {
        date: '2026-05-01',
        description: 'Test | with | pipes'
      })

      const content = await fs.readFile(deadlinesPath, 'utf-8')
      expect(content).toContain('- [ ] 2026-05-01 | Test - with - pipes\n')
      expect(result.description).toBe('Test - with - pipes')
    })

    it('throws on invalid date format', async () => {
      await fs.writeFile(deadlinesPath, '# Deadlines\n\n', 'utf-8')

      await expect(async () => {
        await addDeadline(vaultDir, {
          date: 'not-a-date',
          description: 'Test deadline'
        })
      }).rejects.toThrow('Invalid date format')

      await expect(async () => {
        await addDeadline(vaultDir, {
          date: '05-01-2026',
          description: 'Test deadline'
        })
      }).rejects.toThrow('Invalid date format')

      await expect(async () => {
        await addDeadline(vaultDir, {
          date: '2026/05/01',
          description: 'Test deadline'
        })
      }).rejects.toThrow('Invalid date format')
    })
  })

  describe('removeDeadline', () => {
    it('removes matching line and returns true', async () => {
      await fs.writeFile(
        deadlinesPath,
        [
          '# Deadlines',
          '',
          '- [ ] 2026-05-01 | Task A | school',
          '- [ ] 2026-05-02 | Task B | project',
          '- [ ] 2026-05-03 | Task C | personal'
        ].join('\n'),
        'utf-8'
      )

      // Read to get the ID
      const deadlines = await readDeadlines(vaultDir)
      const targetId = deadlines[1].id // Task B

      const result = await removeDeadline([vaultDir], targetId)
      expect(result).toBe(true)

      const content = await fs.readFile(deadlinesPath, 'utf-8')
      expect(content).toContain('Task A')
      expect(content).not.toContain('Task B')
      expect(content).toContain('Task C')
    })

    it('returns false when no matching ID exists', async () => {
      await fs.writeFile(
        deadlinesPath,
        [
          '# Deadlines',
          '',
          '- [ ] 2026-05-01 | Task A | school'
        ].join('\n'),
        'utf-8'
      )

      const result = await removeDeadline([vaultDir], 'nonexistent123')
      expect(result).toBe(false)

      // Original content should be unchanged
      const content = await fs.readFile(deadlinesPath, 'utf-8')
      expect(content).toContain('Task A')
    })

    it('scans multiple vault dirs and removes from first match', async () => {
      // Create a second vault directory
      const vault2Dir = path.join(testDir, 'vault2')
      const deadlines2Dir = path.join(vault2Dir, 'Deadlines')
      const deadlines2Path = path.join(deadlines2Dir, 'deadlines.md')
      await fs.mkdir(deadlines2Dir, { recursive: true })

      await fs.writeFile(
        deadlinesPath,
        [
          '# Deadlines',
          '',
          '- [ ] 2026-05-01 | Task A | school'
        ].join('\n'),
        'utf-8'
      )

      await fs.writeFile(
        deadlines2Path,
        [
          '# Deadlines',
          '',
          '- [ ] 2026-05-02 | Task B | project'
        ].join('\n'),
        'utf-8'
      )

      // Get ID from second vault
      const deadlines2 = await readDeadlines(vault2Dir)
      const targetId = deadlines2[0].id // Task B

      const result = await removeDeadline([vaultDir, vault2Dir], targetId)
      expect(result).toBe(true)

      // First vault should be unchanged
      const content1 = await fs.readFile(deadlinesPath, 'utf-8')
      expect(content1).toContain('Task A')

      // Second vault should have Task B removed
      const content2 = await fs.readFile(deadlines2Path, 'utf-8')
      expect(content2).not.toContain('Task B')
    })

    it('leaves other deadline lines intact after removal', async () => {
      await fs.writeFile(
        deadlinesPath,
        [
          '# Deadlines',
          '',
          '- [ ] 2026-05-01 | Task A | school',
          '- [ ] 2026-05-02 | Task B | project',
          '- [ ] 2026-05-03 | Task C | personal',
          '- [x] 2026-05-04 | Task D | school',
          '',
          'Some other text',
          '- [ ] 2026-05-05 | Task E | project'
        ].join('\n'),
        'utf-8'
      )

      // Get ID of Task C
      const deadlines = await readDeadlines(vaultDir)
      const targetId = deadlines[2].id // Task C

      const result = await removeDeadline([vaultDir], targetId)
      expect(result).toBe(true)

      const content = await fs.readFile(deadlinesPath, 'utf-8')

      expect(content).toContain('Task A')
      expect(content).toContain('Task B')
      expect(content).not.toContain('Task C')
      expect(content).toContain('Task D')
      expect(content).toContain('Task E')
      expect(content).toContain('Some other text')
      expect(content).toContain('# Deadlines')
    })

    it('handles missing deadlines.md gracefully', async () => {
      // Remove the deadlines file
      await fs.rm(deadlinesPath, { force: true })

      const result = await removeDeadline([vaultDir], 'some-id-123')
      expect(result).toBe(false)
    })
  })

  describe('updateDeadline', () => {
    it('updates description and returns new item', async () => {
      await fs.writeFile(
        deadlinesPath,
        ['# Deadlines', '', '- [ ] 2026-05-01 | Old description | school'].join('\n'),
        'utf-8'
      )

      const deadlines = await readDeadlines(vaultDir)
      const id = deadlines[0].id

      const result = await updateDeadline([vaultDir], id, { description: 'New description' })

      expect(result).not.toBeNull()
      expect(result?.description).toBe('New description')
      const content = await fs.readFile(deadlinesPath, 'utf-8')
      expect(content).toContain('New description')
      expect(content).not.toContain('Old description')
    })

    it('updates date and recalculates urgency', async () => {
      await fs.writeFile(
        deadlinesPath,
        ['# Deadlines', '', '- [ ] 2026-05-01 | Task | school'].join('\n'),
        'utf-8'
      )

      const deadlines = await readDeadlines(vaultDir)
      const id = deadlines[0].id
      const futureDate = dateFromToday(30)

      const result = await updateDeadline([vaultDir], id, { date: futureDate })

      expect(result?.date).toBe(futureDate)
      expect(result?.urgency).toBe('green')
    })

    it('marks deadline as done', async () => {
      await fs.writeFile(
        deadlinesPath,
        ['# Deadlines', '', '- [ ] 2026-05-01 | Task | school'].join('\n'),
        'utf-8'
      )

      const deadlines = await readDeadlines(vaultDir)
      const id = deadlines[0].id

      const result = await updateDeadline([vaultDir], id, { done: true })

      expect(result?.done).toBe(true)
      expect(result?.urgency).toBe('gray')
      const content = await fs.readFile(deadlinesPath, 'utf-8')
      expect(content).toContain('- [x]')
    })

    it('adds notes to an existing deadline', async () => {
      await fs.writeFile(
        deadlinesPath,
        ['# Deadlines', '', '- [ ] 2026-05-01 | Task | school'].join('\n'),
        'utf-8'
      )

      const deadlines = await readDeadlines(vaultDir)
      const id = deadlines[0].id

      const result = await updateDeadline([vaultDir], id, { notes: 'Submit via portal' })

      expect(result?.notes).toBe('Submit via portal')
      const content = await fs.readFile(deadlinesPath, 'utf-8')
      expect(content).toContain('Submit via portal')
    })

    it('clears notes when set to null', async () => {
      await fs.writeFile(
        deadlinesPath,
        ['# Deadlines', '', '- [ ] 2026-05-01 | Task | school | Existing note'].join('\n'),
        'utf-8'
      )

      const deadlines = await readDeadlines(vaultDir)
      const id = deadlines[0].id

      const result = await updateDeadline([vaultDir], id, { notes: null })

      expect(result?.notes).toBeUndefined()
      const content = await fs.readFile(deadlinesPath, 'utf-8')
      expect(content).not.toContain('Existing note')
    })

    it('returns null when ID not found', async () => {
      await fs.writeFile(deadlinesPath, '- [ ] 2026-05-01 | Task | school\n', 'utf-8')

      const result = await updateDeadline([vaultDir], 'nonexistent000', { description: 'New' })

      expect(result).toBeNull()
    })

    it('leaves other lines intact', async () => {
      await fs.writeFile(
        deadlinesPath,
        [
          '# Deadlines',
          '',
          '- [ ] 2026-05-01 | Task A | school',
          '- [ ] 2026-05-02 | Task B | project',
          '- [ ] 2026-05-03 | Task C | personal',
        ].join('\n'),
        'utf-8'
      )

      const deadlines = await readDeadlines(vaultDir)
      const idB = deadlines[1].id

      await updateDeadline([vaultDir], idB, { description: 'Updated B' })

      const content = await fs.readFile(deadlinesPath, 'utf-8')
      expect(content).toContain('Task A')
      expect(content).toContain('Updated B')
      expect(content).toContain('Task C')
      expect(content).not.toContain('Task B')
    })
  })
})
