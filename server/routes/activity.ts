import { Router } from 'express'
import { getGitActivity, type GitActivityData } from '../lib/git-activity-parser.js'
import { config } from 'dotenv'

config()

const router = Router()

// Cache for git activity data (10 minute TTL)
let cachedData: GitActivityData | null = null
let cacheTimestamp: number = 0
const CACHE_TTL_MS = 10 * 60 * 1000 // 10 minutes

router.get('/git-activity', async (_req, res) => {
  try {
    const projectsDir = process.env.PROJECTS_DIR
    if (!projectsDir) {
      return res.status(500).json({ error: 'PROJECTS_DIR not configured' })
    }

    // Check cache
    const now = Date.now()
    if (cachedData && (now - cacheTimestamp) < CACHE_TTL_MS) {
      return res.json(cachedData)
    }

    // Fetch fresh data
    const data = await getGitActivity(projectsDir)

    // Update cache
    cachedData = data
    cacheTimestamp = now

    return res.json(data)
  } catch (err) {
    console.error('Failed to get git activity:', err)
    return res.status(500).json({ error: 'Failed to get git activity' })
  }
})

export { router as activityRouter }
