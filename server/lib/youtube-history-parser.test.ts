import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { promises as fs } from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import {
  parseYouTubeHistory,
  getYouTubeStats,
  getYouTubeHistoryData,
  type YouTubeEntry
} from './youtube-history-parser.js'

describe('YouTube History Parser', () => {
  let tempDir: string

  beforeEach(async () => {
    // Create temp directory for test files
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'youtube-history-test-'))
  })

  afterEach(async () => {
    // Clean up temp directory
    await fs.rm(tempDir, { recursive: true, force: true })
  })

  const createFixture = async (filename: string, data: unknown) => {
    const filePath = path.join(tempDir, filename)
    await fs.writeFile(filePath, JSON.stringify(data), 'utf-8')
    return filePath
  }

  describe('parseYouTubeHistory', () => {
    it('should parse valid YouTube history entries', async () => {
      const fixture = [
        {
          header: 'YouTube',
          title: 'Watched How to Build a Web Scraper',
          titleUrl: 'https://www.youtube.com/watch?v=abc123',
          subtitles: [{ name: 'Tech Channel', url: 'https://www.youtube.com/channel/xyz' }],
          time: '2026-03-15T14:23:45.000Z',
          products: ['YouTube'],
          activityControls: ['YouTube watch history']
        },
        {
          header: 'YouTube',
          title: 'Watched TypeScript Tutorial',
          titleUrl: 'https://www.youtube.com/watch?v=def456',
          subtitles: [{ name: 'Code Academy', url: 'https://www.youtube.com/channel/abc' }],
          time: '2026-03-14T10:00:00.000Z',
          products: ['YouTube'],
          activityControls: ['YouTube watch history']
        }
      ]

      const filePath = await createFixture('history.json', fixture)
      const result = await parseYouTubeHistory(filePath)

      expect(result).toHaveLength(2)
      expect(result[0]).toEqual({
        title: 'How to Build a Web Scraper',
        url: 'https://www.youtube.com/watch?v=abc123',
        channel: 'Tech Channel',
        watchedAt: '2026-03-15T14:23:45.000Z'
      })
      expect(result[1]).toEqual({
        title: 'TypeScript Tutorial',
        url: 'https://www.youtube.com/watch?v=def456',
        channel: 'Code Academy',
        watchedAt: '2026-03-14T10:00:00.000Z'
      })
    })

    it('should strip "Watched " prefix from titles', async () => {
      const fixture = [
        {
          title: 'Watched Test Video',
          titleUrl: 'https://www.youtube.com/watch?v=test',
          subtitles: [{ name: 'Test Channel' }],
          time: '2026-03-15T14:23:45.000Z'
        }
      ]

      const filePath = await createFixture('history.json', fixture)
      const result = await parseYouTubeHistory(filePath)

      expect(result[0].title).toBe('Test Video')
    })

    it('should filter out "Searched for" entries', async () => {
      const fixture = [
        {
          title: 'Watched Valid Video',
          titleUrl: 'https://www.youtube.com/watch?v=valid',
          subtitles: [{ name: 'Channel' }],
          time: '2026-03-15T14:23:45.000Z'
        },
        {
          title: 'Searched for react tutorial',
          titleUrl: 'https://www.youtube.com/results?search_query=react',
          time: '2026-03-15T14:20:00.000Z'
        }
      ]

      const filePath = await createFixture('history.json', fixture)
      const result = await parseYouTubeHistory(filePath)

      expect(result).toHaveLength(1)
      expect(result[0].title).toBe('Valid Video')
    })

    it('should handle missing channel gracefully', async () => {
      const fixture = [
        {
          title: 'Watched Video Without Channel',
          titleUrl: 'https://www.youtube.com/watch?v=test',
          subtitles: [],
          time: '2026-03-15T14:23:45.000Z'
        }
      ]

      const filePath = await createFixture('history.json', fixture)
      const result = await parseYouTubeHistory(filePath)

      expect(result[0].channel).toBe('Unknown Channel')
    })

    it('should skip entries with missing required fields', async () => {
      const fixture = [
        {
          title: 'Valid Video',
          titleUrl: 'https://www.youtube.com/watch?v=valid',
          subtitles: [{ name: 'Channel' }],
          time: '2026-03-15T14:23:45.000Z'
        },
        {
          // Missing titleUrl
          title: 'Invalid Video',
          time: '2026-03-15T14:20:00.000Z'
        },
        {
          // Missing time
          title: 'Another Invalid',
          titleUrl: 'https://www.youtube.com/watch?v=invalid'
        }
      ]

      const filePath = await createFixture('history.json', fixture)
      const result = await parseYouTubeHistory(filePath)

      expect(result).toHaveLength(1)
      expect(result[0].title).toBe('Valid Video')
    })

    it('should deduplicate by URL keeping most recent', async () => {
      const fixture = [
        {
          title: 'Watched Video',
          titleUrl: 'https://www.youtube.com/watch?v=same',
          subtitles: [{ name: 'Channel' }],
          time: '2026-03-15T14:23:45.000Z' // Most recent
        },
        {
          title: 'Watched Video',
          titleUrl: 'https://www.youtube.com/watch?v=same',
          subtitles: [{ name: 'Channel' }],
          time: '2026-03-10T10:00:00.000Z' // Older - should be removed
        },
        {
          title: 'Watched Different Video',
          titleUrl: 'https://www.youtube.com/watch?v=different',
          subtitles: [{ name: 'Channel' }],
          time: '2026-03-12T12:00:00.000Z'
        }
      ]

      const filePath = await createFixture('history.json', fixture)
      const result = await parseYouTubeHistory(filePath)

      expect(result).toHaveLength(2)
      // Should keep the most recent watch of the duplicate
      const duplicateEntry = result.find(e => e.url.includes('same'))
      expect(duplicateEntry?.watchedAt).toBe('2026-03-15T14:23:45.000Z')
    })

    it('should sort by watchedAt descending', async () => {
      const fixture = [
        {
          title: 'Watched Old Video',
          titleUrl: 'https://www.youtube.com/watch?v=old',
          subtitles: [{ name: 'Channel' }],
          time: '2026-03-10T10:00:00.000Z'
        },
        {
          title: 'Watched New Video',
          titleUrl: 'https://www.youtube.com/watch?v=new',
          subtitles: [{ name: 'Channel' }],
          time: '2026-03-15T14:23:45.000Z'
        },
        {
          title: 'Watched Middle Video',
          titleUrl: 'https://www.youtube.com/watch?v=mid',
          subtitles: [{ name: 'Channel' }],
          time: '2026-03-12T12:00:00.000Z'
        }
      ]

      const filePath = await createFixture('history.json', fixture)
      const result = await parseYouTubeHistory(filePath)

      expect(result[0].title).toBe('New Video')
      expect(result[1].title).toBe('Middle Video')
      expect(result[2].title).toBe('Old Video')
    })

    it('should handle malformed JSON gracefully', async () => {
      const filePath = path.join(tempDir, 'bad.json')
      await fs.writeFile(filePath, 'not valid json', 'utf-8')

      const result = await parseYouTubeHistory(filePath)
      expect(result).toEqual([])
    })

    it('should handle non-array JSON gracefully', async () => {
      const filePath = await createFixture('bad.json', { not: 'an array' })

      const result = await parseYouTubeHistory(filePath)
      expect(result).toEqual([])
    })

    it('should handle missing file gracefully', async () => {
      const result = await parseYouTubeHistory('/nonexistent/path/history.json')
      expect(result).toEqual([])
    })
  })

  describe('getYouTubeStats', () => {
    const mockEntries: YouTubeEntry[] = [
      // Last 30 days
      {
        title: 'Recent Video 1',
        url: 'https://www.youtube.com/watch?v=r1',
        channel: 'Popular Channel',
        watchedAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 5).toISOString() // 5 days ago
      },
      {
        title: 'Recent Video 2',
        url: 'https://www.youtube.com/watch?v=r2',
        channel: 'Popular Channel',
        watchedAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 10).toISOString() // 10 days ago
      },
      {
        title: 'Recent Video 3',
        url: 'https://www.youtube.com/watch?v=r3',
        channel: 'Another Channel',
        watchedAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 15).toISOString() // 15 days ago
      },
      // Older than 30 days
      {
        title: 'Old Video',
        url: 'https://www.youtube.com/watch?v=old',
        channel: 'Old Channel',
        watchedAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 40).toISOString() // 40 days ago
      }
    ]

    it('should return correct total count', () => {
      const stats = getYouTubeStats(mockEntries)
      expect(stats.total).toBe(4)
    })

    it('should filter last30Days correctly', () => {
      const stats = getYouTubeStats(mockEntries)
      expect(stats.last30Days).toHaveLength(3)
      expect(stats.last30Days.every(e => e.title.startsWith('Recent'))).toBe(true)
    })

    it('should limit last30Days to 50 entries', () => {
      // Create 60 recent entries
      const manyEntries: YouTubeEntry[] = Array.from({ length: 60 }, (_, i) => ({
        title: `Video ${i}`,
        url: `https://www.youtube.com/watch?v=${i}`,
        channel: 'Channel',
        watchedAt: new Date(Date.now() - 1000 * 60 * 60 * i).toISOString() // Spread over hours
      }))

      const stats = getYouTubeStats(manyEntries)
      expect(stats.last30Days).toHaveLength(50)
    })

    it('should group by month correctly', () => {
      const entries: YouTubeEntry[] = [
        {
          title: 'March Video 1',
          url: 'https://www.youtube.com/watch?v=m1',
          channel: 'Channel',
          watchedAt: '2026-03-15T14:23:45.000Z'
        },
        {
          title: 'March Video 2',
          url: 'https://www.youtube.com/watch?v=m2',
          channel: 'Channel',
          watchedAt: '2026-03-10T10:00:00.000Z'
        },
        {
          title: 'February Video',
          url: 'https://www.youtube.com/watch?v=f1',
          channel: 'Channel',
          watchedAt: '2026-02-20T12:00:00.000Z'
        }
      ]

      const stats = getYouTubeStats(entries)
      expect(stats.byMonth).toHaveLength(2)
      expect(stats.byMonth[0].month).toBe('2026-03')
      expect(stats.byMonth[0].count).toBe(2)
      expect(stats.byMonth[1].month).toBe('2026-02')
      expect(stats.byMonth[1].count).toBe(1)
    })

    it('should include top channels per month', () => {
      const entries: YouTubeEntry[] = [
        {
          title: 'Video 1',
          url: 'https://www.youtube.com/watch?v=1',
          channel: 'Channel A',
          watchedAt: '2026-03-15T14:23:45.000Z'
        },
        {
          title: 'Video 2',
          url: 'https://www.youtube.com/watch?v=2',
          channel: 'Channel A',
          watchedAt: '2026-03-14T10:00:00.000Z'
        },
        {
          title: 'Video 3',
          url: 'https://www.youtube.com/watch?v=3',
          channel: 'Channel B',
          watchedAt: '2026-03-13T10:00:00.000Z'
        }
      ]

      const stats = getYouTubeStats(entries)
      expect(stats.byMonth[0].topChannels).toEqual(['Channel A', 'Channel B'])
    })

    it('should return top 5 channels from last 30 days', () => {
      const stats = getYouTubeStats(mockEntries)
      expect(stats.topChannels).toHaveLength(2) // Only 2 channels in last 30 days
      expect(stats.topChannels[0]).toEqual({ name: 'Popular Channel', count: 2 })
      expect(stats.topChannels[1]).toEqual({ name: 'Another Channel', count: 1 })
    })

    it('should sort top channels by count descending', () => {
      const entries: YouTubeEntry[] = Array.from({ length: 10 }, (_, i) => ({
        title: `Video ${i}`,
        url: `https://www.youtube.com/watch?v=${i}`,
        channel: i < 5 ? 'Popular' : i < 8 ? 'Medium' : 'Rare',
        watchedAt: new Date(Date.now() - 1000 * 60 * 60 * i).toISOString()
      }))

      const stats = getYouTubeStats(entries)
      expect(stats.topChannels[0].name).toBe('Popular')
      expect(stats.topChannels[0].count).toBe(5)
      expect(stats.topChannels[1].name).toBe('Medium')
      expect(stats.topChannels[1].count).toBe(3)
      expect(stats.topChannels[2].name).toBe('Rare')
      expect(stats.topChannels[2].count).toBe(2)
    })

    it('should handle empty history', () => {
      const stats = getYouTubeStats([])
      expect(stats.total).toBe(0)
      expect(stats.last30Days).toEqual([])
      expect(stats.byMonth).toEqual([])
      expect(stats.topChannels).toEqual([])
    })
  })

  describe('getYouTubeHistoryData', () => {
    it('should return unavailable when no file path provided', async () => {
      const result = await getYouTubeHistoryData()
      expect(result).toEqual({
        available: false,
        total: 0,
        last30Days: [],
        byMonth: [],
        topChannels: []
      })
    })

    it('should return unavailable when file does not exist', async () => {
      const result = await getYouTubeHistoryData('/nonexistent/path/history.json')
      expect(result).toEqual({
        available: false,
        total: 0,
        last30Days: [],
        byMonth: [],
        topChannels: []
      })
    })

    it('should return unavailable when file is empty or malformed', async () => {
      const filePath = await createFixture('empty.json', [])
      const result = await getYouTubeHistoryData(filePath)
      expect(result).toEqual({
        available: false,
        total: 0,
        last30Days: [],
        byMonth: [],
        topChannels: []
      })
    })

    it('should return available with stats when file exists and is valid', async () => {
      const fixture = [
        {
          title: 'Watched Test Video',
          titleUrl: 'https://www.youtube.com/watch?v=test',
          subtitles: [{ name: 'Test Channel' }],
          time: new Date(Date.now() - 1000 * 60 * 60 * 24 * 5).toISOString() // 5 days ago
        }
      ]

      const filePath = await createFixture('history.json', fixture)
      const result = await getYouTubeHistoryData(filePath)

      expect(result.available).toBe(true)
      expect(result.total).toBe(1)
      expect(result.last30Days).toHaveLength(1)
      expect(result.topChannels).toHaveLength(1)
    })
  })
})
