import { Router } from 'express'
import { parseChromebookmarks } from '../lib/bookmarks-parser.js'
import { parseReadingLog, appendToReadingLog } from '../lib/reading-log-parser.js'
import { config } from 'dotenv'

config()

const router = Router()

interface ReadingItem {
  id: string
  title: string
  url: string
  read: boolean
  date?: Date
  source: 'bookmarks' | 'reading-log'
  tags: string[]
}

/**
 * Normalize URL for deduplication
 * Lowercase, strip trailing slash, strip www.
 */
function normalizeUrl(url: string): string {
  let normalized = url.toLowerCase().trim()

  // Strip trailing slash
  if (normalized.endsWith('/')) {
    normalized = normalized.slice(0, -1)
  }

  // Strip www. prefix
  normalized = normalized.replace(/^(https?:\/\/)www\./, '$1')

  return normalized
}

/**
 * Generate a stable ID from normalized URL
 */
function generateId(url: string): string {
  return normalizeUrl(url)
}

/**
 * Extract top N significant words from titles for topic clustering
 */
function extractTopics(items: ReadingItem[]): Array<{ topic: string; count: number }> {
  const stopwords = new Set([
    'the', 'a', 'an', 'of', 'in', 'to', 'for', 'and', 'or', 'on', 'at', 'by', 'with',
    'how', 'why', 'what', 'when', 'where', 'who', 'is', 'are', 'was', 'were', 'be',
    'this', 'that', 'it', 'from', 'as', 'you', 'your', 'do', 'can', 'will', 'should',
  ])

  const wordCounts = new Map<string, number>()

  for (const item of items) {
    // Extract words from title (3+ chars, lowercase, alphanumeric)
    const words = item.title
      .toLowerCase()
      .split(/\s+/)
      .map(w => w.replace(/[^a-z0-9]/g, ''))
      .filter(w => w.length >= 3 && !stopwords.has(w))

    // Count occurrences
    for (const word of words) {
      wordCounts.set(word, (wordCounts.get(word) || 0) + 1)
    }
  }

  // Sort by count descending and take top 10
  return Array.from(wordCounts.entries())
    .map(([topic, count]) => ({ topic, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10)
}

/**
 * Merge and deduplicate bookmarks and reading log items
 */
async function getMergedReadingItems(vaultDir: string): Promise<ReadingItem[]> {
  // Fetch both sources in parallel
  const [bookmarks, readingLogItems] = await Promise.all([
    parseChromebookmarks(),
    parseReadingLog(vaultDir),
  ])

  // Build a map keyed by normalized URL
  const itemMap = new Map<string, ReadingItem>()

  // Add bookmarks first (will be overridden by reading log if duplicate)
  for (const bookmark of bookmarks) {
    const id = generateId(bookmark.url)
    itemMap.set(id, {
      id,
      title: bookmark.name,
      url: bookmark.url,
      read: false,  // Bookmarks default to unread
      date: bookmark.addedAt,
      source: 'bookmarks',
      tags: [],
    })
  }

  // Add reading log items (takes precedence for read status)
  for (const item of readingLogItems) {
    const id = generateId(item.url)
    itemMap.set(id, {
      id,
      title: item.title,
      url: item.url,
      read: item.read,
      date: item.date ? new Date(item.date) : undefined,
      source: 'reading-log',
      tags: item.tags,
    })
  }

  // Convert map to array and sort by date descending
  return Array.from(itemMap.values()).sort((a, b) => {
    const dateA = a.date ? a.date.getTime() : 0
    const dateB = b.date ? b.date.getTime() : 0
    return dateB - dateA
  })
}

/**
 * GET /api/reading?status=all|read|unread
 * Returns merged and deduplicated reading items
 */
router.get('/', async (req, res) => {
  const { VAULT_DIR } = process.env
  if (!VAULT_DIR) {
    return res.status(500).json({ error: 'VAULT_DIR not configured' })
  }

  try {
    const allItems = await getMergedReadingItems(VAULT_DIR)

    // Filter by status
    const status = req.query.status as string || 'all'
    let items: ReadingItem[]
    if (status === 'read') {
      items = allItems.filter(i => i.read)
    } else if (status === 'unread') {
      items = allItems.filter(i => !i.read)
    } else {
      items = allItems
    }

    const unread = allItems.filter(i => !i.read).length
    const read = allItems.filter(i => i.read).length

    // Extract top topics
    const topTopics = extractTopics(allItems)

    return res.json({
      total: allItems.length,
      unread,
      read,
      items,
      topTopics,
    })
  } catch (err) {
    console.error('Failed to fetch reading items:', err)
    return res.status(500).json({ error: 'Failed to fetch reading items' })
  }
})

/**
 * POST /api/reading
 * Body: { url: string, title?: string }
 * Appends a new item to ReadingLog.md
 */
router.post('/', async (req, res) => {
  const { VAULT_DIR } = process.env
  if (!VAULT_DIR) {
    return res.status(500).json({ error: 'VAULT_DIR not configured' })
  }

  const { url, title } = req.body

  // Validate URL
  if (!url || typeof url !== 'string' || url.trim().length === 0) {
    return res.status(400).json({ error: 'URL is required' })
  }

  // Basic URL validation
  try {
    new URL(url)
  } catch {
    return res.status(400).json({ error: 'Invalid URL format' })
  }

  try {
    await appendToReadingLog(VAULT_DIR, url, title)
    return res.json({ success: true })
  } catch (err) {
    console.error('Failed to add reading item:', err)
    return res.status(500).json({ error: 'Failed to add reading item' })
  }
})

export default router
