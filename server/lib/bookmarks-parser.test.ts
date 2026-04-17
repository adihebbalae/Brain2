import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { promises as fs } from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { parseChromebookmarks, getChromeBookmarksPath } from './bookmarks-parser.js'

describe('bookmarks-parser', () => {
  let tempDir: string

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'cortex-bookmarks-test-'))
  })

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true })
  })

  it('should return empty array when bookmarks file does not exist', async () => {
    // Set env to non-existent path
    const originalPath = process.env.CHROME_BOOKMARKS_PATH
    process.env.CHROME_BOOKMARKS_PATH = path.join(tempDir, 'nonexistent', 'Bookmarks')

    const result = await parseChromebookmarks()

    expect(result).toEqual([])

    process.env.CHROME_BOOKMARKS_PATH = originalPath
  })

  it('should parse a simple bookmarks tree from bookmark_bar', async () => {
    const bookmarksPath = path.join(tempDir, 'Bookmarks')
    const bookmarksData = {
      roots: {
        bookmark_bar: {
          children: [
            {
              type: 'url',
              name: 'Example Site',
              url: 'https://example.com',
              date_added: '13318709270000000', // Windows FILETIME
            },
          ],
        },
      },
    }

    await fs.writeFile(bookmarksPath, JSON.stringify(bookmarksData), 'utf-8')

    const originalPath = process.env.CHROME_BOOKMARKS_PATH
    process.env.CHROME_BOOKMARKS_PATH = bookmarksPath

    const result = await parseChromebookmarks()

    expect(result).toHaveLength(1)
    expect(result[0].name).toBe('Example Site')
    expect(result[0].url).toBe('https://example.com')
    expect(result[0].source).toBe('bookmarks')
    expect(result[0].addedAt).toBeInstanceOf(Date)

    process.env.CHROME_BOOKMARKS_PATH = originalPath
  })

  it('should recursively extract bookmarks from nested folders', async () => {
    const bookmarksPath = path.join(tempDir, 'Bookmarks')
    const bookmarksData = {
      roots: {
        bookmark_bar: {
          children: [
            {
              type: 'folder',
              name: 'Dev Resources',
              children: [
                {
                  type: 'url',
                  name: 'GitHub',
                  url: 'https://github.com',
                  date_added: '13318709270000000',
                },
                {
                  type: 'folder',
                  name: 'Docs',
                  children: [
                    {
                      type: 'url',
                      name: 'MDN',
                      url: 'https://developer.mozilla.org',
                      date_added: '13318709270000000',
                    },
                  ],
                },
              ],
            },
          ],
        },
      },
    }

    await fs.writeFile(bookmarksPath, JSON.stringify(bookmarksData), 'utf-8')

    const originalPath = process.env.CHROME_BOOKMARKS_PATH
    process.env.CHROME_BOOKMARKS_PATH = bookmarksPath

    const result = await parseChromebookmarks()

    expect(result).toHaveLength(2)
    expect(result.map(r => r.name)).toContain('GitHub')
    expect(result.map(r => r.name)).toContain('MDN')

    process.env.CHROME_BOOKMARKS_PATH = originalPath
  })

  it('should extract bookmarks from all three roots', async () => {
    const bookmarksPath = path.join(tempDir, 'Bookmarks')
    const bookmarksData = {
      roots: {
        bookmark_bar: {
          children: [
            { type: 'url', name: 'Bar Item', url: 'https://bar.com', date_added: '13318709270000000' },
          ],
        },
        other: {
          children: [
            { type: 'url', name: 'Other Item', url: 'https://other.com', date_added: '13318709270000000' },
          ],
        },
        synced: {
          children: [
            { type: 'url', name: 'Synced Item', url: 'https://synced.com', date_added: '13318709270000000' },
          ],
        },
      },
    }

    await fs.writeFile(bookmarksPath, JSON.stringify(bookmarksData), 'utf-8')

    const originalPath = process.env.CHROME_BOOKMARKS_PATH
    process.env.CHROME_BOOKMARKS_PATH = bookmarksPath

    const result = await parseChromebookmarks()

    expect(result).toHaveLength(3)
    expect(result.map(r => r.name)).toContain('Bar Item')
    expect(result.map(r => r.name)).toContain('Other Item')
    expect(result.map(r => r.name)).toContain('Synced Item')

    process.env.CHROME_BOOKMARKS_PATH = originalPath
  })

  it('should correctly convert Windows FILETIME to JavaScript Date', async () => {
    const bookmarksPath = path.join(tempDir, 'Bookmarks')
    // Test with a known date: Jan 1, 2024 00:00:00 UTC
    // JavaScript: 1704067200000 ms
    // FILETIME: (1704067200000 + 11644473600000) * 1000 = 13348540800000000
    const bookmarksData = {
      roots: {
        bookmark_bar: {
          children: [
            {
              type: 'url',
              name: 'Test',
              url: 'https://test.com',
              date_added: '13348540800000000',
            },
          ],
        },
      },
    }

    await fs.writeFile(bookmarksPath, JSON.stringify(bookmarksData), 'utf-8')

    const originalPath = process.env.CHROME_BOOKMARKS_PATH
    process.env.CHROME_BOOKMARKS_PATH = bookmarksPath

    const result = await parseChromebookmarks()

    expect(result).toHaveLength(1)
    expect(result[0].addedAt.toISOString()).toBe('2024-01-01T00:00:00.000Z')

    process.env.CHROME_BOOKMARKS_PATH = originalPath
  })

  it('should skip folder nodes and only extract URL nodes', async () => {
    const bookmarksPath = path.join(tempDir, 'Bookmarks')
    const bookmarksData = {
      roots: {
        bookmark_bar: {
          children: [
            {
              type: 'folder',
              name: 'My Folder',
              children: [
                { type: 'url', name: 'URL Item', url: 'https://url.com', date_added: '13318709270000000' },
              ],
            },
          ],
        },
      },
    }

    await fs.writeFile(bookmarksPath, JSON.stringify(bookmarksData), 'utf-8')

    const originalPath = process.env.CHROME_BOOKMARKS_PATH
    process.env.CHROME_BOOKMARKS_PATH = bookmarksPath

    const result = await parseChromebookmarks()

    // Should only have 1 URL item, not the folder
    expect(result).toHaveLength(1)
    expect(result[0].name).toBe('URL Item')

    process.env.CHROME_BOOKMARKS_PATH = originalPath
  })

  it('should handle missing date_added gracefully', async () => {
    const bookmarksPath = path.join(tempDir, 'Bookmarks')
    const bookmarksData = {
      roots: {
        bookmark_bar: {
          children: [
            {
              type: 'url',
              name: 'No Date',
              url: 'https://nodate.com',
              // No date_added field
            },
          ],
        },
      },
    }

    await fs.writeFile(bookmarksPath, JSON.stringify(bookmarksData), 'utf-8')

    const originalPath = process.env.CHROME_BOOKMARKS_PATH
    process.env.CHROME_BOOKMARKS_PATH = bookmarksPath

    const result = await parseChromebookmarks()

    expect(result).toHaveLength(1)
    expect(result[0].addedAt).toBeInstanceOf(Date)
    // Should default to epoch (Jan 1, 1970)
    expect(result[0].addedAt.getTime()).toBe(0)

    process.env.CHROME_BOOKMARKS_PATH = originalPath
  })

  it('getChromeBookmarksPath should use CHROME_BOOKMARKS_PATH env var if set', () => {
    const customPath = '/custom/path/to/Bookmarks'
    const originalPath = process.env.CHROME_BOOKMARKS_PATH
    process.env.CHROME_BOOKMARKS_PATH = customPath

    const result = getChromeBookmarksPath()

    expect(result).toBe(customPath)

    process.env.CHROME_BOOKMARKS_PATH = originalPath
  })

  it('getChromeBookmarksPath should fall back to default Windows path', () => {
    const originalPath = process.env.CHROME_BOOKMARKS_PATH
    const originalLocalAppData = process.env.LOCALAPPDATA

    delete process.env.CHROME_BOOKMARKS_PATH
    process.env.LOCALAPPDATA = 'C:\\Users\\TestUser\\AppData\\Local'

    const result = getChromeBookmarksPath()

    expect(result).toBe('C:\\Users\\TestUser\\AppData\\Local\\Google\\Chrome\\User Data\\Default\\Bookmarks')

    process.env.CHROME_BOOKMARKS_PATH = originalPath
    process.env.LOCALAPPDATA = originalLocalAppData
  })
})
