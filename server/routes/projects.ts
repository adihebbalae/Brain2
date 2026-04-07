import { Router } from 'express'
import path from 'node:path'
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
    const resolvedProjectsDir = path.resolve(projectsDir)
    const safeProjects = projects.map(p => ({
      ...p,
      vscodeUrl: `vscode://file/${p.path}`,
      path: path.relative(resolvedProjectsDir, p.path),
    }))
    return res.json(safeProjects)
  } catch (err) {
    console.error('Failed to scan projects:', err)
    return res.status(500).json({ error: 'Failed to scan projects' })
  }
})

export { router as projectsRouter }
