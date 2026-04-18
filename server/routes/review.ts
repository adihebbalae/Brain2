import { Router } from 'express'
import path from 'node:path'
import { config } from 'dotenv'
import { getReviewQueue, getRandomNote } from '../lib/review-queue.js'
import { loadReviewLog, markReviewed } from '../lib/review-log.js'
import { getPrimaryVaultDir, isPathInVault } from '../lib/vault-config.js'

config()

const router = Router()

/**
 * GET /api/review-queue
 * Returns queue of notes to review with counts
 */
router.get('/queue', async (_req, res) => {
  try {
    const vaultDir = getPrimaryVaultDir()
    const queue = await getReviewQueue(vaultDir, 10)
    const log = await loadReviewLog(vaultDir)

    // Calculate counts
    let totalDue = 0
    let neverReviewed = 0

    for (const [_path, lastReviewed] of Object.entries(log)) {
      if (lastReviewed === null) {
        neverReviewed++
        totalDue++
      } else {
        const reviewedAt = new Date(lastReviewed)
        const now = new Date()
        const daysSince = Math.floor((now.getTime() - reviewedAt.getTime()) / (1000 * 60 * 60 * 24))

        if (daysSince > 30) {
          totalDue++
        }
      }
    }

    return res.json({
      queue,
      totalDue,
      neverReviewed
    })
  } catch (err) {
    console.error('[review] Error fetching review queue:', err)
    return res.status(500).json({ error: 'Failed to fetch review queue' })
  }
})

/**
 * POST /api/review-log
 * Mark a note as reviewed
 * Body: { filePath: string }  (relative path from vault root)
 */
router.post('/log', async (req, res) => {
  try {
    const vaultDir = getPrimaryVaultDir()
    const { filePath } = req.body as { filePath?: unknown }

    // Validate filePath
    if (typeof filePath !== 'string' || filePath.trim().length === 0) {
      return res.status(400).json({ error: 'filePath is required and must be a non-empty string' })
    }

    // Path traversal protection: must be relative path
    if (path.isAbsolute(filePath)) {
      return res.status(400).json({ error: 'filePath must be a relative path' })
    }

    // Resolve to absolute path and check it's within vault
    const absolutePath = path.resolve(vaultDir, filePath)

    if (!(await isPathInVault(absolutePath))) {
      return res.status(403).json({ error: 'filePath must be within configured vault directories' })
    }

    // Normalize path separators to forward slashes for consistency in log
    const normalizedPath = filePath.replace(/\\/g, '/')

    // Mark as reviewed
    await markReviewed(vaultDir, normalizedPath)

    return res.json({
      success: true,
      reviewedAt: new Date().toISOString()
    })
  } catch (err) {
    console.error('[review] Error marking note as reviewed:', err)
    return res.status(500).json({ error: 'Failed to mark note as reviewed' })
  }
})

/**
 * GET /api/review-queue/random
 * Returns a single random vault note regardless of review status
 */
router.get('/queue/random', async (_req, res) => {
  try {
    const vaultDir = getPrimaryVaultDir()
    const randomNote = await getRandomNote(vaultDir)

    if (!randomNote) {
      return res.json({ note: null })
    }

    return res.json({ note: randomNote })
  } catch (err) {
    console.error('[review] Error fetching random note:', err)
    return res.status(500).json({ error: 'Failed to fetch random note' })
  }
})

export { router as reviewRouter }
