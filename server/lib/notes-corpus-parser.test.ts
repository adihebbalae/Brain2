import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { promises as fs } from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { parseNotesCorpus } from './notes-corpus-parser.js'

describe('Notes Corpus Parser', () => {
  let tempDir: string

  beforeEach(async () => {
    // Create a temporary directory for testing
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'cortex-corpus-test-'))
  })

  afterEach(async () => {
    // Clean up temporary directory
    try {
      await fs.rm(tempDir, { recursive: true, force: true })
    } catch (error) {
      console.error('Failed to clean up temp dir:', error)
    }
  })

  describe('parseNotesCorpus', () => {
    it('should return empty array if file does not exist', async () => {
      const nonExistentPath = path.join(tempDir, 'does-not-exist.txt')
      const items = await parseNotesCorpus(nonExistentPath)

      expect(items).toEqual([])
    })

    it('should parse checkbox-style TODOs', async () => {
      const corpusPath = path.join(tempDir, 'corpus.txt')
      await fs.writeFile(corpusPath, `
- [ ] this is a todo item
* [ ] another todo with asterisk
• [ ] bullet point todo
[ ] todo without prefix
`, 'utf-8')

      const items = await parseNotesCorpus(corpusPath)

      expect(items).toHaveLength(4)
      items.forEach(item => {
        expect(item.type).toBe('todo')
        expect(item.source).toBe('corpus')
      })
    })

    it('should parse TODO/FIXME/HACK comments', async () => {
      const corpusPath = path.join(tempDir, 'corpus.txt')
      await fs.writeFile(corpusPath, `
TODO: implement this feature
FIXME: broken calculation here
HACK: temporary workaround for bug
todo: lowercase todo also works
`, 'utf-8')

      const items = await parseNotesCorpus(corpusPath)

      expect(items).toHaveLength(4)
      items.forEach(item => {
        expect(item.type).toBe('todo')
      })
    })

    it('should parse idea patterns', async () => {
      const corpusPath = path.join(tempDir, 'corpus.txt')
      await fs.writeFile(corpusPath, `
idea: create a mobile app version
IDEA: add dark mode support
idea - implement keyboard shortcuts
This line has idea: embedded in middle
`, 'utf-8')

      const items = await parseNotesCorpus(corpusPath)

      expect(items).toHaveLength(4)
      items.forEach(item => {
        expect(item.type).toBe('idea')
      })
    })

    it('should default to note type for other content', async () => {
      const corpusPath = path.join(tempDir, 'corpus.txt')
      await fs.writeFile(corpusPath, `
This is a regular note with enough characters
Another interesting observation about the system
Some prose text that should be captured
`, 'utf-8')

      const items = await parseNotesCorpus(corpusPath)

      expect(items).toHaveLength(3)
      items.forEach(item => {
        expect(item.type).toBe('note')
      })
    })

    it('should skip blank lines', async () => {
      const corpusPath = path.join(tempDir, 'corpus.txt')
      await fs.writeFile(corpusPath, `
TODO: first task

TODO: second task


TODO: third task
`, 'utf-8')

      const items = await parseNotesCorpus(corpusPath)

      expect(items).toHaveLength(3)
    })

    it('should skip lines with only punctuation', async () => {
      const corpusPath = path.join(tempDir, 'corpus.txt')
      await fs.writeFile(corpusPath, `
TODO: actual task
---
***
...
TODO: another task
`, 'utf-8')

      const items = await parseNotesCorpus(corpusPath)

      expect(items).toHaveLength(2)
      expect(items[0].text).toContain('actual task')
      expect(items[1].text).toContain('another task')
    })

    it('should skip short lines (less than 10 chars)', async () => {
      const corpusPath = path.join(tempDir, 'corpus.txt')
      await fs.writeFile(corpusPath, `
TODO: this is long enough to be captured
short
x
TODO: another valid line
`, 'utf-8')

      const items = await parseNotesCorpus(corpusPath)

      expect(items).toHaveLength(2)
    })

    it('should skip header lines (all-caps short strings)', async () => {
      const corpusPath = path.join(tempDir, 'corpus.txt')
      await fs.writeFile(corpusPath, `
PROJECT IDEAS
TODO: actual task under header
NOTES AND THOUGHTS
This is a regular note that is long enough
ANOTHER HEADER
`, 'utf-8')

      const items = await parseNotesCorpus(corpusPath)

      expect(items).toHaveLength(2)
      expect(items[0].text).toContain('actual task')
      expect(items[1].text).toContain('regular note')
    })

    it('should generate stable IDs for items', async () => {
      const corpusPath = path.join(tempDir, 'corpus.txt')
      await fs.writeFile(corpusPath, `
TODO: same task appears twice
TODO: different task
TODO: same task appears twice
`, 'utf-8')

      const items = await parseNotesCorpus(corpusPath)

      expect(items).toHaveLength(3)
      // Same text should have same ID
      expect(items[0].id).toBe(items[2].id)
      // Different text should have different ID
      expect(items[0].id).not.toBe(items[1].id)
    })

    it('should include all required fields in items', async () => {
      const corpusPath = path.join(tempDir, 'corpus.txt')
      await fs.writeFile(corpusPath, `
TODO: test item with all fields
`, 'utf-8')

      const items = await parseNotesCorpus(corpusPath)

      expect(items).toHaveLength(1)
      const item = items[0]
      expect(item).toHaveProperty('id')
      expect(item).toHaveProperty('text')
      expect(item).toHaveProperty('type')
      expect(item).toHaveProperty('source')
      expect(item.id).toBeTruthy()
      expect(item.text).toBeTruthy()
      expect(['todo', 'idea', 'note']).toContain(item.type)
      expect(item.source).toBe('corpus')
    })

    it('should handle mixed content types', async () => {
      const corpusPath = path.join(tempDir, 'corpus.txt')
      await fs.writeFile(corpusPath, `
SECTION HEADER

- [ ] checkbox todo item
TODO: comment style todo
idea: creative thought here
This is just a regular note with enough characters

ANOTHER HEADER
FIXME: something broken
idea - another creative thought
Final note that is long enough to be included
`, 'utf-8')

      const items = await parseNotesCorpus(corpusPath)

      const todos = items.filter(i => i.type === 'todo')
      const ideas = items.filter(i => i.type === 'idea')
      const notes = items.filter(i => i.type === 'note')

      expect(todos.length).toBeGreaterThan(0)
      expect(ideas.length).toBeGreaterThan(0)
      expect(notes.length).toBeGreaterThan(0)
    })

    it('should trim whitespace from parsed lines', async () => {
      const corpusPath = path.join(tempDir, 'corpus.txt')
      await fs.writeFile(corpusPath, `
   TODO: task with leading spaces
		TODO: task with tabs
  idea: spaced idea content
`, 'utf-8')

      const items = await parseNotesCorpus(corpusPath)

      expect(items).toHaveLength(3)
      items.forEach(item => {
        expect(item.text).not.toMatch(/^\s/)
        expect(item.text).not.toMatch(/\s$/)
      })
    })

    it('should handle empty file', async () => {
      const corpusPath = path.join(tempDir, 'corpus.txt')
      await fs.writeFile(corpusPath, '', 'utf-8')

      const items = await parseNotesCorpus(corpusPath)

      expect(items).toEqual([])
    })

    it('should handle file with only whitespace', async () => {
      const corpusPath = path.join(tempDir, 'corpus.txt')
      await fs.writeFile(corpusPath, '   \n\n\t\t\n   ', 'utf-8')

      const items = await parseNotesCorpus(corpusPath)

      expect(items).toEqual([])
    })
  })
})
