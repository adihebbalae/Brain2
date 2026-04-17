import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { promises as fs } from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { parseReadingLog, appendToReadingLog } from './reading-log-parser.js'

describe('reading-log-parser', () => {
  let tempDir: string

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'cortex-reading-test-'))
  })

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true })
  })

  it('should create ReadingLog.md if it does not exist', async () => {
    const result = await parseReadingLog(tempDir)

    expect(result).toEqual([])

    // Check that file was created
    const readingLogPath = path.join(tempDir, 'Resources', 'ReadingLog.md')
    const exists = await fs.access(readingLogPath).then(() => true).catch(() => false)
    expect(exists).toBe(true)

    const content = await fs.readFile(readingLogPath, 'utf-8')
    expect(content).toContain('# Reading List')
  })

  it('should parse unchecked items with full format', async () => {
    const readingLogPath = path.join(tempDir, 'Resources', 'ReadingLog.md')
    await fs.mkdir(path.join(tempDir, 'Resources'), { recursive: true })
    await fs.writeFile(
      readingLogPath,
      '- [ ] 2026-04-10 | [TypeScript Deep Dive](https://example.com/typescript) | tech\n',
      'utf-8'
    )

    const result = await parseReadingLog(tempDir)

    expect(result).toHaveLength(1)
    expect(result[0]).toEqual({
      title: 'TypeScript Deep Dive',
      url: 'https://example.com/typescript',
      read: false,
      date: '2026-04-10',
      tags: ['tech'],
      source: 'reading-log',
    })
  })

  it('should parse checked items', async () => {
    const readingLogPath = path.join(tempDir, 'Resources', 'ReadingLog.md')
    await fs.mkdir(path.join(tempDir, 'Resources'), { recursive: true })
    await fs.writeFile(
      readingLogPath,
      '- [x] 2026-04-10 | [Finished Article](https://example.com/done) | tech\n',
      'utf-8'
    )

    const result = await parseReadingLog(tempDir)

    expect(result).toHaveLength(1)
    expect(result[0].read).toBe(true)
  })

  it('should parse items without date', async () => {
    const readingLogPath = path.join(tempDir, 'Resources', 'ReadingLog.md')
    await fs.mkdir(path.join(tempDir, 'Resources'), { recursive: true })
    await fs.writeFile(
      readingLogPath,
      '- [ ] [No Date Article](https://example.com/nodate)\n',
      'utf-8'
    )

    const result = await parseReadingLog(tempDir)

    expect(result).toHaveLength(1)
    expect(result[0].title).toBe('No Date Article')
    expect(result[0].date).toBeUndefined()
  })

  it('should parse items without tags', async () => {
    const readingLogPath = path.join(tempDir, 'Resources', 'ReadingLog.md')
    await fs.mkdir(path.join(tempDir, 'Resources'), { recursive: true })
    await fs.writeFile(
      readingLogPath,
      '- [ ] 2026-04-10 | [No Tags](https://example.com/notags)\n',
      'utf-8'
    )

    const result = await parseReadingLog(tempDir)

    expect(result).toHaveLength(1)
    expect(result[0].tags).toEqual([])
  })

  it('should parse multiple tags separated by commas', async () => {
    const readingLogPath = path.join(tempDir, 'Resources', 'ReadingLog.md')
    await fs.mkdir(path.join(tempDir, 'Resources'), { recursive: true })
    await fs.writeFile(
      readingLogPath,
      '- [ ] 2026-04-10 | [Multi Tag](https://example.com/multi) | tech, ai, research\n',
      'utf-8'
    )

    const result = await parseReadingLog(tempDir)

    expect(result).toHaveLength(1)
    expect(result[0].tags).toEqual(['tech', 'ai', 'research'])
  })

  it('should skip lines that do not match the format', async () => {
    const readingLogPath = path.join(tempDir, 'Resources', 'ReadingLog.md')
    await fs.mkdir(path.join(tempDir, 'Resources'), { recursive: true })
    await fs.writeFile(
      readingLogPath,
      `# Reading List

This is a comment

- [ ] 2026-04-10 | [Valid Item](https://example.com/valid) | tech

Some other text

- Not a valid item

- [ ] 2026-04-11 | [Another Valid](https://example.com/another)
`,
      'utf-8'
    )

    const result = await parseReadingLog(tempDir)

    expect(result).toHaveLength(2)
    expect(result[0].title).toBe('Valid Item')
    expect(result[1].title).toBe('Another Valid')
  })

  it('should trim whitespace from titles, urls, and tags', async () => {
    const readingLogPath = path.join(tempDir, 'Resources', 'ReadingLog.md')
    await fs.mkdir(path.join(tempDir, 'Resources'), { recursive: true })
    await fs.writeFile(
      readingLogPath,
      '- [ ] 2026-04-10 |  [ Title With Spaces ]( https://example.com/spaces )  | tag1 , tag2 \n',
      'utf-8'
    )

    const result = await parseReadingLog(tempDir)

    expect(result).toHaveLength(1)
    expect(result[0].title).toBe('Title With Spaces')
    expect(result[0].url).toBe('https://example.com/spaces')
    expect(result[0].tags).toEqual(['tag1', 'tag2'])
  })

  it('appendToReadingLog should create file and append entry', async () => {
    await appendToReadingLog(tempDir, 'https://example.com/new', 'New Article')

    const readingLogPath = path.join(tempDir, 'Resources', 'ReadingLog.md')
    const content = await fs.readFile(readingLogPath, 'utf-8')

    expect(content).toContain('New Article')
    expect(content).toContain('https://example.com/new')
    expect(content).toContain('- [ ]')

    // Should have today's date
    const today = new Date().toISOString().split('T')[0]
    expect(content).toContain(today)
  })

  it('appendToReadingLog should use domain name as title if not provided', async () => {
    await appendToReadingLog(tempDir, 'https://github.com/user/repo')

    const readingLogPath = path.join(tempDir, 'Resources', 'ReadingLog.md')
    const content = await fs.readFile(readingLogPath, 'utf-8')

    expect(content).toContain('[github.com]')
    expect(content).toContain('https://github.com/user/repo')
  })

  it('appendToReadingLog should append to existing file', async () => {
    const readingLogPath = path.join(tempDir, 'Resources', 'ReadingLog.md')
    await fs.mkdir(path.join(tempDir, 'Resources'), { recursive: true })
    await fs.writeFile(
      readingLogPath,
      '- [ ] 2026-04-10 | [Existing](https://existing.com)\n',
      'utf-8'
    )

    await appendToReadingLog(tempDir, 'https://new.com', 'New Entry')

    const content = await fs.readFile(readingLogPath, 'utf-8')
    expect(content).toContain('[Existing]')
    expect(content).toContain('[New Entry]')
  })

  it('should handle entries with special characters in title', async () => {
    const readingLogPath = path.join(tempDir, 'Resources', 'ReadingLog.md')
    await fs.mkdir(path.join(tempDir, 'Resources'), { recursive: true })
    await fs.writeFile(
      readingLogPath,
      '- [ ] 2026-04-10 | [TypeScript: The Good Parts](https://example.com/ts) | tech\n',
      'utf-8'
    )

    const result = await parseReadingLog(tempDir)

    expect(result).toHaveLength(1)
    expect(result[0].title).toBe('TypeScript: The Good Parts')
  })
})
