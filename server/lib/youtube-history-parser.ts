import path from 'node:path'
import { promises as fs, type Dirent } from 'node:fs'
import { getDataDir } from './data-dir.js'
import { parseYouTubeWatchHistoryHtml } from './wiki-import-parsers.js'

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
  title?: string
  titleUrl?: string
  subtitles?: Array<{ name?: string }>
  time?: string
}

/**
 * Parse a single raw YouTube history entry from the legacy JSON export.
 */
function parseLegacyEntry(raw: RawYouTubeEntry): YouTubeEntry | null {
  if (!raw.title || !raw.titleUrl || !raw.time) {
    return null
  }

  if (raw.title.startsWith('Searched for')) {
    return null
  }

  const title = raw.title.startsWith('Watched ') ? raw.title.slice(8) : raw.title
  const channel = raw.subtitles?.[0]?.name?.trim() || 'Unknown Channel'

  return {
    title,
    url: raw.titleUrl,
    channel,
    watchedAt: raw.time,
  }
}

/**
 * Deduplicate entries by URL and keep the most recent watch.
 */
function deduplicateByUrl(entries: YouTubeEntry[]): YouTubeEntry[] {
  const urlMap = new Map<string, YouTubeEntry>()
  const sorted = [...entries].sort(
    (a, b) => new Date(b.watchedAt).getTime() - new Date(a.watchedAt).getTime(),
  )

  for (const entry of sorted) {
    if (!urlMap.has(entry.url)) {
      urlMap.set(entry.url, entry)
    }
  }

  return Array.from(urlMap.values())
}

/**
 * Group entries by month (YYYY-MM).
 */
function groupByMonth(entries: YouTubeEntry[]): MonthGroup[] {
  const monthMap = new Map<string, YouTubeEntry[]>()

  for (const entry of entries) {
    const date = new Date(entry.watchedAt)
    const month = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`

    if (!monthMap.has(month)) {
      monthMap.set(month, [])
    }

    monthMap.get(month)?.push(entry)
  }

  return Array.from(monthMap.entries())
    .map(([month, videos]) => ({
      month,
      count: videos.length,
      videos: videos.sort(
        (a, b) => new Date(b.watchedAt).getTime() - new Date(a.watchedAt).getTime(),
      ),
    }))
    .sort((a, b) => b.month.localeCompare(a.month))
}

/**
 * Get top N channels by watch count over the last N days.
 */
function getTopChannels(entries: YouTubeEntry[], days: number, topN: number = 5): ChannelStats[] {
  const cutoffDate = new Date()
  cutoffDate.setDate(cutoffDate.getDate() - days)

  const channelCounts = new Map<string, number>()
  for (const entry of entries) {
    if (new Date(entry.watchedAt) < cutoffDate) {
      continue
    }

    channelCounts.set(entry.channel, (channelCounts.get(entry.channel) || 0) + 1)
  }

  return Array.from(channelCounts.entries())
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, topN)
}

/**
 * Parse YouTube watch history from a legacy JSON export or Takeout HTML export.
 */
export async function parseYouTubeHistory(filePath: string): Promise<YouTubeEntry[]> {
  const resolvedPath = await resolveYouTubeHistoryPath(filePath)
  if (!resolvedPath) {
    return []
  }

  try {
    const content = await fs.readFile(resolvedPath, 'utf-8')
    const trimmed = content.trimStart()

    let entries: YouTubeEntry[] = []

    if (resolvedPath.toLowerCase().endsWith('.html') || trimmed.startsWith('<!doctype html') || trimmed.startsWith('<html')) {
      entries = parseYouTubeWatchHistoryHtml(content)
        .filter(entry => !entry.isAd)
        .map(entry => ({
          title: entry.title,
          url: entry.url,
          channel: entry.channel,
          watchedAt: entry.watchedAt,
        }))
    } else {
      const rawEntries = JSON.parse(content) as RawYouTubeEntry[]
      if (!Array.isArray(rawEntries)) {
        console.error('YouTube history file is not an array')
        return []
      }

      entries = rawEntries
        .map(parseLegacyEntry)
        .filter((entry): entry is YouTubeEntry => Boolean(entry))
    }

    const deduplicated = deduplicateByUrl(entries)
    deduplicated.sort((a, b) => new Date(b.watchedAt).getTime() - new Date(a.watchedAt).getTime())
    return deduplicated
  } catch (error) {
    console.error('Failed to parse YouTube history:', error)
    return []
  }
}

/**
 * Get YouTube statistics from parsed history.
 */
export function getYouTubeStats(history: YouTubeEntry[]): Omit<YouTubeHistory, 'available'> {
  const thirtyDaysAgo = new Date()
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

  const last30Days = history
    .filter(entry => new Date(entry.watchedAt) >= thirtyDaysAgo)
    .slice(0, 50)

  const monthGroups = groupByMonth(history)
  const topChannels = getTopChannels(history, 30, 5)

  const byMonth = monthGroups.map(group => {
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
      topChannels: topChannelsForMonth,
    }
  })

  return {
    total: history.length,
    last30Days,
    byMonth,
    topChannels,
  }
}

/**
 * Get full YouTube history data with auto-detection for Takeout HTML or legacy JSON.
 */
export async function getYouTubeHistoryData(filePath?: string): Promise<YouTubeHistory> {
  const resolvedPath = await resolveYouTubeHistoryPath(filePath)
  if (!resolvedPath) {
    return emptyHistory()
  }

  const history = await parseYouTubeHistory(resolvedPath)
  if (history.length === 0) {
    return emptyHistory()
  }

  return {
    available: true,
    ...getYouTubeStats(history),
  }
}

async function resolveYouTubeHistoryPath(filePath?: string): Promise<string | null> {
  if (filePath) {
    const candidates = await resolveConfiguredCandidates(filePath)
    for (const candidate of candidates) {
      if (await isFile(candidate)) {
        return candidate
      }
    }

    return null
  }

  return findHistoryUnderDataDir()
}

async function resolveConfiguredCandidates(filePath: string): Promise<string[]> {
  const resolved = path.resolve(filePath)

  try {
    const stat = await fs.stat(resolved)
    if (stat.isFile()) {
      return [resolved]
    }

    if (stat.isDirectory()) {
      return buildDirectoryCandidates(resolved)
    }
  } catch {
    return buildDirectoryCandidates(resolved)
  }

  return [resolved]
}

async function findHistoryUnderDataDir(): Promise<string | null> {
  const dataDir = getDataDir()

  let topLevelEntries: string[] = []
  try {
    topLevelEntries = await fs.readdir(dataDir)
  } catch {
    return null
  }

  for (const entry of topLevelEntries) {
    const root = path.join(dataDir, entry)
    const candidates = buildDirectoryCandidates(root)
    for (const candidate of candidates) {
      if (await isFile(candidate)) {
        return candidate
      }
    }
  }

  return findHistoryRecursively(dataDir)
}

function buildDirectoryCandidates(root: string): string[] {
  return [
    path.join(root, 'history', 'watch-history.html'),
    path.join(root, 'history', 'watch-history.json'),
    path.join(root, 'watch-history.html'),
    path.join(root, 'watch-history.json'),
    path.join(root, 'Takeout', 'YouTube and YouTube Music', 'history', 'watch-history.html'),
    path.join(root, 'Takeout', 'YouTube and YouTube Music', 'history', 'watch-history.json'),
  ]
}

async function findHistoryRecursively(root: string): Promise<string | null> {
  const stack = [root]
  let firstJsonMatch: string | null = null

  while (stack.length > 0) {
    const current = stack.pop()
    if (!current) {
      continue
    }

    let entries: Dirent[] = []
    try {
      entries = await fs.readdir(current, { withFileTypes: true })
    } catch {
      continue
    }

    for (const entry of entries) {
      const entryPath = path.join(current, entry.name)
      if (entry.isDirectory()) {
        stack.push(entryPath)
        continue
      }

      const normalizedName = entry.name.toLowerCase()
      if (normalizedName === 'watch-history.html') {
        return entryPath
      }

      if (normalizedName === 'watch-history.json' && !firstJsonMatch) {
        firstJsonMatch = entryPath
      }
    }
  }

  return firstJsonMatch
}

async function isFile(filePath: string): Promise<boolean> {
  try {
    const stat = await fs.stat(filePath)
    return stat.isFile()
  } catch {
    return false
  }
}

function emptyHistory(): YouTubeHistory {
  return {
    available: false,
    total: 0,
    last30Days: [],
    byMonth: [],
    topChannels: [],
  }
}
