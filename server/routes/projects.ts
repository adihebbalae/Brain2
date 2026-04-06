import { Router } from 'express'
import { scanProjects } from '../lib/scanner.js'
import { config } from 'dotenv'

config()

const router = Router()

router.get('/', async (_req, res) => {
  try {
    const projectsDir = process.env.PROJECTS_DIR
    if (!projectsDir) {
      return res.status(500).json({ error: 'PROJECTS_DIR not configured' })
    }
    const projects = await scanProjects(projectsDir)
    return res.json(projects)
  } catch (err) {
    console.error('Failed to scan projects:', err)
    return res.status(500).json({ error: 'Failed to scan projects' })
  }
})

export { router as projectsRouter }
