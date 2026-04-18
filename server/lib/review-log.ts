import { promises as fs } from 'node:fs'
import path from 'node:path'
import { glob } from 'glob'

export interface ReviewLog {
  [relativePath: string]: string | null  // null = never reviewed, otherwise ISO timestamp
}

/**
 * Get the review log file path
 */
function getReviewLogPath(vaultDir: string): string {
  return path.join(vaultDir, 'Resources', 'review-log.json')
}

/**
 * Load review log from disk
 * Returns empty object if file doesn't exist
 */
export async function loadReviewLog(vaultDir: string): Promise<ReviewLog> {
  const logPath = getReviewLogPath(vaultDir)

  try {
    const content = await fs.readFile(logPath, 'utf-8')
    const parsed = JSON.parse(content)

    // Validate it's an object
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
      console.warn('[review-log] Invalid review log format, returning empty')
      return {}
    }

    return parsed as ReviewLog
  } catch (err) {
    const error = err as NodeJS.ErrnoException
    if (error.code === 'ENOENT') {
      // File doesn't exist yet
      return {}
    }
    console.error('[review-log] Error loading review log:', err)
    return {}
  }
}

/**
 * Save review log to disk
 * Auto-creates Resources directory if needed
 */
export async function saveReviewLog(vaultDir: string, log: ReviewLog): Promise<void> {
  const logPath = getReviewLogPath(vaultDir)
  const resourcesDir = path.dirname(logPath)

  // Ensure Resources directory exists
  await fs.mkdir(resourcesDir, { recursive: true })

  // Write atomically using temp file + rename
  const tempPath = logPath + '.tmp'
  await fs.writeFile(tempPath, JSON.stringify(log, null, 2), 'utf-8')
  await fs.rename(tempPath, logPath)
}

/**
 * Mark a single note as reviewed (updates timestamp to now)
 */
export async function markReviewed(vaultDir: string, relativePath: string): Promise<void> {
  const log = await loadReviewLog(vaultDir)
  log[relativePath] = new Date().toISOString()
  await saveReviewLog(vaultDir, log)
}

/**
 * Scan vault for all *.md files (excluding DailyNotes/, Resources/)
 * and add any new notes not yet in the log with value null
 */
export async function syncNewNotes(vaultDir: string): Promise<void> {
  const log = await loadReviewLog(vaultDir)

  // Scan vault for *.md files
  const pattern = path.join(vaultDir, '**', '*.md').replace(/\\/g, '/')
  const files = await glob(pattern, {
    ignore: [
      '**/DailyNotes/**',
      '**/Resources/**',
      '**/node_modules/**',
      '**/.git/**'
    ],
    nodir: true
  })

  let addedCount = 0

  for (const absPath of files) {
    // Convert to relative path from vaultDir
    const relativePath = path.relative(vaultDir, absPath)
    // Normalize to forward slashes for consistency (glob returns forward slashes)
    const normalizedPath = relativePath.replace(/\\/g, '/')

    // Add to log if not already present
    if (!(normalizedPath in log)) {
      log[normalizedPath] = null
      addedCount++
    }
  }

  if (addedCount > 0) {
    await saveReviewLog(vaultDir, log)
    console.log(`[review-log] Added ${addedCount} new notes to review log`)
  }
}
