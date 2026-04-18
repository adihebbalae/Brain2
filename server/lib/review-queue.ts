import { promises as fs } from 'node:fs'
import path from 'node:path'
import { loadReviewLog } from './review-log.js'

export type ReviewStatus = 'never_reviewed' | 'overdue_90d' | 'overdue_60d' | 'overdue_30d' | 'current'

export interface ReviewQueueItem {
  relativePath: string
  title: string              // filename without extension
  preview: string            // first 100 chars of file content
  lastReviewed: string | null  // ISO date or null
  status: ReviewStatus
  daysSince: number | null   // null if never reviewed
}

/**
 * Calculate days since a given ISO timestamp
 */
function calculateDaysSince(isoDate: string): number {
  const reviewedAt = new Date(isoDate)
  const now = new Date()
  const diffMs = now.getTime() - reviewedAt.getTime()
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))
  return diffDays
}

/**
 * Determine review status based on last reviewed date
 */
function calculateStatus(lastReviewed: string | null): ReviewStatus {
  if (lastReviewed === null) {
    return 'never_reviewed'
  }

  const daysSince = calculateDaysSince(lastReviewed)

  if (daysSince > 90) return 'overdue_90d'
  if (daysSince > 60) return 'overdue_60d'
  if (daysSince > 30) return 'overdue_30d'
  return 'current'
}

/**
 * Calculate priority score for sorting (lower = higher priority)
 */
function calculateScore(status: ReviewStatus): number {
  switch (status) {
    case 'never_reviewed': return 0
    case 'overdue_90d': return 1
    case 'overdue_60d': return 2
    case 'overdue_30d': return 3
    case 'current': return 4
  }
}

/**
 * Read first 100 chars of a file for preview
 */
async function readPreview(vaultDir: string, relativePath: string): Promise<string> {
  try {
    const absPath = path.join(vaultDir, relativePath)
    const content = await fs.readFile(absPath, 'utf-8')

    // Strip YAML frontmatter if present
    let text = content
    if (content.startsWith('---')) {
      const secondDelim = content.indexOf('---', 3)
      if (secondDelim !== -1) {
        text = content.substring(secondDelim + 3).trim()
      }
    }

    // Remove markdown headers and formatting for cleaner preview
    text = text
      .replace(/^#+\s+/gm, '') // Remove headers
      .replace(/\*\*/g, '')    // Remove bold
      .replace(/\*/g, '')      // Remove italic
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // Remove links, keep text
      .trim()

    return text.substring(0, 100)
  } catch (err) {
    console.error(`[review-queue] Error reading preview for ${relativePath}:`, err)
    return ''
  }
}

/**
 * Get the review queue with priority sorting
 * Returns notes that need review (excludes 'current' status)
 */
export async function getReviewQueue(vaultDir: string, maxItems: number = 10): Promise<ReviewQueueItem[]> {
  const log = await loadReviewLog(vaultDir)

  const items: ReviewQueueItem[] = []

  for (const [relativePath, lastReviewed] of Object.entries(log)) {
    const status = calculateStatus(lastReviewed)

    // Exclude 'current' items (reviewed within 30 days)
    if (status === 'current') continue

    const daysSince = lastReviewed ? calculateDaysSince(lastReviewed) : null
    const title = path.basename(relativePath, path.extname(relativePath))
    const preview = await readPreview(vaultDir, relativePath)

    items.push({
      relativePath,
      title,
      preview,
      lastReviewed,
      status,
      daysSince
    })
  }

  // Sort by score (asc), then by daysSince (desc) within same score bucket
  items.sort((a, b) => {
    const scoreA = calculateScore(a.status)
    const scoreB = calculateScore(b.status)

    if (scoreA !== scoreB) {
      return scoreA - scoreB
    }

    // Within same score bucket, sort by daysSince descending (longest first)
    // Handle null (never reviewed) as infinity
    const daysA = a.daysSince ?? Infinity
    const daysB = b.daysSince ?? Infinity
    return daysB - daysA
  })

  return items.slice(0, maxItems)
}

/**
 * Get a random note from the vault (regardless of review status)
 * For the "Surprise Me" feature
 */
export async function getRandomNote(vaultDir: string): Promise<ReviewQueueItem | null> {
  const log = await loadReviewLog(vaultDir)
  const paths = Object.keys(log)

  if (paths.length === 0) {
    return null
  }

  // Pick random path
  const randomPath = paths[Math.floor(Math.random() * paths.length)]
  const lastReviewed = log[randomPath]
  const status = calculateStatus(lastReviewed)
  const daysSince = lastReviewed ? calculateDaysSince(lastReviewed) : null
  const title = path.basename(randomPath, path.extname(randomPath))
  const preview = await readPreview(vaultDir, randomPath)

  return {
    relativePath: randomPath,
    title,
    preview,
    lastReviewed,
    status,
    daysSince
  }
}
