import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import request from 'supertest'
import express, { Express } from 'express'
import { promises as fs } from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import readingRouter from './reading.js'

describe('reading route', () => {
  let app: Express
  let tempDir: string
  let originalVaultDir: string | undefined

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'cortex-reading-route-test-'))

    // Set up test environment
    originalVaultDir = process.env.VAULT_DIR
    process.env.VAULT_DIR = tempDir

    app = express()
    app.use(express.json())
    app.use('/api/reading', readingRouter)
  })

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true })
    process.env.VAULT_DIR = originalVaultDir
  })

  it('should return empty list when no bookmarks or reading log', async () => {
    // Set Chrome bookmarks to non-existent path
    const originalChromePath = process.env.CHROME_BOOKMARKS_PATH
    process.env.CHROME_BOOKMARKS_PATH = path.join(tempDir, 'nonexistent', 'Bookmarks')

    const response = await request(app).get('/api/reading')

    expect(response.status).toBe(200)
    expect(response.body).toEqual({
      total: 0,
      unread: 0,
      read: 0,
      items: [],
      topTopics: [],
    })

    process.env.CHROME_BOOKMARKS_PATH = originalChromePath
  })

  it('should deduplicate items by normalized URL', async () => {
    // Create reading log with one entry
    const readingLogPath = path.join(tempDir, 'Resources', 'ReadingLog.md')
    await fs.mkdir(path.join(tempDir, 'Resources'), { recursive: true })
    await fs.writeFile(
      readingLogPath,
      '- [x] 2026-04-10 | [My Article](https://example.com/page) | tech\n',
      'utf-8'
    )

    // Create Chrome bookmarks with same URL (different normalization)
    const bookmarksPath = path.join(tempDir, 'Bookmarks')
    const bookmarksData = {
      roots: {
        bookmark_bar: {
          children: [
            {
              type: 'url',
              name: 'Example Page',
              url: 'https://www.example.com/page/',  // www. prefix and trailing slash
              date_added: '13318709270000000',
            },
          ],
        },
      },
    }
    await fs.writeFile(bookmarksPath, JSON.stringify(bookmarksData), 'utf-8')

    const originalChromePath = process.env.CHROME_BOOKMARKS_PATH
    process.env.CHROME_BOOKMARKS_PATH = bookmarksPath

    const response = await request(app).get('/api/reading')

    expect(response.status).toBe(200)
    // Should have only 1 item (deduplicated)
    expect(response.body.total).toBe(1)
    // Reading log entry should take precedence (read=true)
    expect(response.body.items[0].read).toBe(true)
    expect(response.body.items[0].title).toBe('My Article')
    expect(response.body.items[0].source).toBe('reading-log')

    process.env.CHROME_BOOKMARKS_PATH = originalChromePath
  })

  it('should filter by status=unread', async () => {
    const readingLogPath = path.join(tempDir, 'Resources', 'ReadingLog.md')
    await fs.mkdir(path.join(tempDir, 'Resources'), { recursive: true })
    await fs.writeFile(
      readingLogPath,
      `- [ ] 2026-04-10 | [Unread 1](https://example.com/unread1)
- [x] 2026-04-11 | [Read 1](https://example.com/read1)
- [ ] 2026-04-12 | [Unread 2](https://example.com/unread2)
`,
      'utf-8'
    )

    const response = await request(app).get('/api/reading?status=unread')

    expect(response.status).toBe(200)
    expect(response.body.total).toBe(3)
    expect(response.body.unread).toBe(2)
    expect(response.body.read).toBe(1)
    expect(response.body.items).toHaveLength(2)
    expect(response.body.items.every((item: any) => !item.read)).toBe(true)
  })

  it('should filter by status=read', async () => {
    const readingLogPath = path.join(tempDir, 'Resources', 'ReadingLog.md')
    await fs.mkdir(path.join(tempDir, 'Resources'), { recursive: true })
    await fs.writeFile(
      readingLogPath,
      `- [ ] 2026-04-10 | [Unread 1](https://example.com/unread1)
- [x] 2026-04-11 | [Read 1](https://example.com/read1)
- [x] 2026-04-12 | [Read 2](https://example.com/read2)
`,
      'utf-8'
    )

    const response = await request(app).get('/api/reading?status=read')

    expect(response.status).toBe(200)
    expect(response.body.items).toHaveLength(2)
    expect(response.body.items.every((item: any) => item.read)).toBe(true)
  })

  it('should extract top topics from titles', async () => {
    const readingLogPath = path.join(tempDir, 'Resources', 'ReadingLog.md')
    await fs.mkdir(path.join(tempDir, 'Resources'), { recursive: true })
    await fs.writeFile(
      readingLogPath,
      `- [ ] 2026-04-10 | [TypeScript Deep Dive](https://example.com/ts1)
- [ ] 2026-04-11 | [Learning TypeScript](https://example.com/ts2)
- [ ] 2026-04-12 | [React and TypeScript](https://example.com/react)
- [ ] 2026-04-13 | [React Hooks Guide](https://example.com/hooks)
`,
      'utf-8'
    )

    const response = await request(app).get('/api/reading')

    expect(response.status).toBe(200)
    expect(response.body.topTopics).toBeInstanceOf(Array)

    // TypeScript should be most common (appears 3 times)
    const typescriptTopic = response.body.topTopics.find((t: any) => t.topic === 'typescript')
    expect(typescriptTopic).toBeDefined()
    expect(typescriptTopic.count).toBe(3)

    // React should appear (appears 2 times)
    const reactTopic = response.body.topTopics.find((t: any) => t.topic === 'react')
    expect(reactTopic).toBeDefined()
    expect(reactTopic.count).toBe(2)
  })

  it('should filter stopwords from topics', async () => {
    const readingLogPath = path.join(tempDir, 'Resources', 'ReadingLog.md')
    await fs.mkdir(path.join(tempDir, 'Resources'), { recursive: true })
    await fs.writeFile(
      readingLogPath,
      '- [ ] 2026-04-10 | [How to Learn the TypeScript](https://example.com/ts)\n',
      'utf-8'
    )

    const response = await request(app).get('/api/reading')

    expect(response.status).toBe(200)
    // "how", "to", "the" should be filtered out
    const topics = response.body.topTopics.map((t: any) => t.topic)
    expect(topics).not.toContain('how')
    expect(topics).not.toContain('the')
    expect(topics).toContain('typescript')
    expect(topics).toContain('learn')
  })

  it('POST /api/reading should add item to reading log', async () => {
    const response = await request(app)
      .post('/api/reading')
      .send({ url: 'https://example.com/new', title: 'New Article' })

    expect(response.status).toBe(200)
    expect(response.body.success).toBe(true)

    // Verify it was added
    const readingLogPath = path.join(tempDir, 'Resources', 'ReadingLog.md')
    const content = await fs.readFile(readingLogPath, 'utf-8')
    expect(content).toContain('New Article')
    expect(content).toContain('https://example.com/new')
  })

  it('POST /api/reading should use domain as title if not provided', async () => {
    const response = await request(app)
      .post('/api/reading')
      .send({ url: 'https://github.com/user/repo' })

    expect(response.status).toBe(200)

    const readingLogPath = path.join(tempDir, 'Resources', 'ReadingLog.md')
    const content = await fs.readFile(readingLogPath, 'utf-8')
    expect(content).toContain('github.com')
  })

  it('POST /api/reading should validate URL', async () => {
    const response = await request(app)
      .post('/api/reading')
      .send({ url: 'not-a-valid-url' })

    expect(response.status).toBe(400)
    expect(response.body.error).toContain('Invalid URL')
  })

  it('POST /api/reading should require URL', async () => {
    const response = await request(app)
      .post('/api/reading')
      .send({})

    expect(response.status).toBe(400)
    expect(response.body.error).toContain('URL is required')
  })

  it('should return 500 when VAULT_DIR not configured', async () => {
    delete process.env.VAULT_DIR

    const app2 = express()
    app2.use(express.json())
    app2.use('/api/reading', readingRouter)

    const response = await request(app2).get('/api/reading')

    expect(response.status).toBe(500)
    expect(response.body.error).toContain('VAULT_DIR not configured')
  })

  it('should sort items by date descending', async () => {
    const readingLogPath = path.join(tempDir, 'Resources', 'ReadingLog.md')
    await fs.mkdir(path.join(tempDir, 'Resources'), { recursive: true })
    await fs.writeFile(
      readingLogPath,
      `- [ ] 2026-04-08 | [Oldest](https://example.com/old)
- [ ] 2026-04-12 | [Newest](https://example.com/new)
- [ ] 2026-04-10 | [Middle](https://example.com/mid)
`,
      'utf-8'
    )

    const response = await request(app).get('/api/reading')

    expect(response.status).toBe(200)
    expect(response.body.items).toHaveLength(3)
    // Should be sorted newest first
    expect(response.body.items[0].title).toBe('Newest')
    expect(response.body.items[1].title).toBe('Middle')
    expect(response.body.items[2].title).toBe('Oldest')
  })
})
