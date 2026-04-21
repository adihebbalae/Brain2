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

    // Map status from backend enum to frontend enum
    const statusMap: Record<string, 'active' | 'stale' | 'archived' | 'unknown'> = {
      in_progress: 'active',
      blocked: 'active',
      not_started: 'active',
      completed: 'archived',
      stale: 'stale',
    }

    const safeProjects = projects.map(p => ({
      ...p,
      status: statusMap[p.status] ?? 'unknown',
      vscodeUrl: `vscode://file/${p.path}`,
      path: path.relative(resolvedProjectsDir, p.path),
      // These fields are not computed by the scanner — default to 0/false.
      // The TODO aggregator fetches todos independently via /api/todos.
      openTodos: 0,
      todos: 0,
      hasDeadlines: false,
    }))
    return res.json(safeProjects)
  } catch (err) {
    console.error('Failed to scan projects:', err)
    return res.status(500).json({ error: 'Failed to scan projects' })
  }
})

export { router as projectsRouter }
