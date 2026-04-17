import { promises as fs } from 'node:fs'

export interface YouTubeEntry {
  title: string
  url: string
  channel: string
  watchedAt: string
}

export interface MonthGroup {
  month: string
  count: number
  videos: YouTubeEntry[]
}

export interface ChannelStats {
  name: string
  count: number
}

export interface YouTubeHistory {
  available: boolean
  total: number
  last30Days: YouTubeEntry[]
  byMonth: Array<{ month: string; count: number; topChannels: string[] }>
  topChannels: ChannelStats[]
}

interface RawYouTubeEntry {
  header?: string
  title?: string
  titleUrl?: string
  subtitles?: Array<{ name?: string; url?: string }>
  time?: string
  products?: string[]
  activityControls?: string[]
}

/**
 * Parse a single raw YouTube history entry
 */
function parseEntry(raw: RawYouTubeEntry): YouTubeEntry | null {
  // Validate required fields
  if (!raw.title || !raw.titleUrl || !raw.time) {
    return null
  }

  // Filter out "Searched for" entries
  if (raw.title.startsWith('Searched for')) {
    return null
  }

  // Strip "Watched " prefix if present
  let title = raw.title
  if (title.startsWith('Watched ')) {
    title = title.substring(8)
  }

  // Extract channel name from subtitles
  const channel = raw.subtitles && raw.subtitles.length > 0 && raw.subtitles[0].name
    ? raw.subtitles[0].name
    : 'Unknown Channel'

  return {
    title,
    url: raw.titleUrl,
    channel,
    watchedAt: raw.time
  }
}

/**
 * Deduplicate entries by URL (keep most recent)
 */
function deduplicateByUrl(entries: YouTubeEntry[]): YouTubeEntry[] {
  const urlMap = new Map<string, YouTubeEntry>()

  // Process in reverse chronological order to keep most recent
  const sorted = [...entries].sort((a, b) =>
    new Date(b.watchedAt).getTime() - new Date(a.watchedAt).getTime()
  )

  for (const entry of sorted) {
    if (!urlMap.has(entry.url)) {
      urlMap.set(entry.url, entry)
    }
  }

  return Array.from(urlMap.values())
}

/**
 * Group entries by month (YYYY-MM format)
 */
function groupByMonth(entries: YouTubeEntry[]): MonthGroup[] {
  const monthMap = new Map<string, YouTubeEntry[]>()

  for (const entry of entries) {
    const date = new Date(entry.watchedAt)
    const month = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`

    if (!monthMap.has(month)) {
      monthMap.set(month, [])
    }

    monthMap.get(month)!.push(entry)
  }

  // Convert to array and sort by month descending
  const groups = Array.from(monthMap.entries())
    .map(([month, videos]) => ({
      month,
      count: videos.length,
      videos: videos.sort((a, b) =>
        new Date(b.watchedAt).getTime() - new Date(a.watchedAt).getTime()
      )
    }))
    .sort((a, b) => b.month.localeCompare(a.month))

  return groups
}

/**
 * Get top N channels by watch count over last N days
 */
function getTopChannels(entries: YouTubeEntry[], days: number, topN: number = 5): ChannelStats[] {
  const cutoffDate = new Date()
  cutoffDate.setDate(cutoffDate.getDate() - days)

  // Filter to entries within the time window
  const recentEntries = entries.filter(entry =>
    new Date(entry.watchedAt) >= cutoffDate
  )

  // Count by channel
  const channelCounts = new Map<string, number>()
  for (const entry of recentEntries) {
    channelCounts.set(entry.channel, (channelCounts.get(entry.channel) || 0) + 1)
  }

  // Convert to array and sort by count descending
  const channels = Array.from(channelCounts.entries())
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, topN)

  return channels
}

/**
 * Parse YouTube watch history from Google Takeout JSON file
 */
export async function parseYouTubeHistory(filePath: string): Promise<YouTubeEntry[]> {
  try {
    const content = await fs.readFile(filePath, 'utf-8')
    const rawEntries = JSON.parse(content) as RawYouTubeEntry[]

    if (!Array.isArray(rawEntries)) {
      console.error('YouTube history file is not an array')
      return []
    }

    // Parse and filter entries
    const entries: YouTubeEntry[] = []
    for (const raw of rawEntries) {
      const parsed = parseEntry(raw)
      if (parsed) {
        entries.push(parsed)
      }
    }

    // Deduplicate by URL (keep most recent)
    const deduplicated = deduplicateByUrl(entries)

    // Sort by watchedAt descending
    deduplicated.sort((a, b) =>
      new Date(b.watchedAt).getTime() - new Date(a.watchedAt).getTime()
    )

    return deduplicated
  } catch (err) {
    console.error('Failed to parse YouTube history:', err)
    return []
  }
}

/**
 * Get YouTube statistics from parsed history
 */
export function getYouTubeStats(history: YouTubeEntry[]): Omit<YouTubeHistory, 'available'> {
  // Get last 30 days (max 50 entries)
  const thirtyDaysAgo = new Date()
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

  const last30Days = history
    .filter(entry => new Date(entry.watchedAt) >= thirtyDaysAgo)
    .slice(0, 50)

  // Group by month
  const monthGroups = groupByMonth(history)

  // Get top 5 channels from last 30 days
  const topChannels = getTopChannels(history, 30, 5)

  // Build month summary with top channels
  const byMonth = monthGroups.map(group => {
    // Get top 3 channels for this month
    const monthChannels = new Map<string, number>()
    for (const video of group.videos) {
      monthChannels.set(video.channel, (monthChannels.get(video.channel) || 0) + 1)
    }

    const topChannelsForMonth = Array.from(monthChannels.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([name]) => name)

    return {
      month: group.month,
      count: group.count,
      topChannels: topChannelsForMonth
    }
  })

  return {
    total: history.length,
    last30Days,
    byMonth,
    topChannels
  }
}

/**
 * Get full YouTube history data with availability check
 */
export async function getYouTubeHistoryData(filePath?: string): Promise<YouTubeHistory> {
  // Return empty state if no file path configured
  if (!filePath) {
    return {
      available: false,
      total: 0,
      last30Days: [],
      byMonth: [],
      topChannels: []
    }
  }

  try {
    // Check if file exists
    await fs.access(filePath)
  } catch {
    // File not found - return empty state
    return {
      available: false,
      total: 0,
      last30Days: [],
      byMonth: [],
      topChannels: []
    }
  }

  // Parse history
  const history = await parseYouTubeHistory(filePath)

  // If parsing failed or returned empty, return unavailable
  if (history.length === 0) {
    return {
      available: false,
      total: 0,
      last30Days: [],
      byMonth: [],
      topChannels: []
    }
  }

  // Get stats
  const stats = getYouTubeStats(history)

  return {
    available: true,
    ...stats
  }
}
