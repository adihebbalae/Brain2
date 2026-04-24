import { Router } from 'express'
import { getCachedGitActivity } from '../lib/git-activity-cache.js'
import { config } from 'dotenv'

config()

const router = Router()

router.get('/git-activity', async (_req, res) => {
  try {
    const projectsDir = process.env.PROJECTS_DIR
    if (!projectsDir) {
      return res.status(500).json({ error: 'PROJECTS_DIR not configured' })
    }

    const data = await getCachedGitActivity(projectsDir)

    return res.json(data)
  } catch (err) {
    console.error('Failed to get git activity:', err)
    return res.status(500).json({ error: 'Failed to get git activity' })
  }
})

export { router as activityRouter }
