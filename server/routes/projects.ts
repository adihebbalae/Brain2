import { Router } from 'express'
import path from 'node:path'
import { promises as fs } from 'node:fs'
import { scanProjects } from '../lib/scanner.js'
import { generateProjectGitSummary } from '../lib/git-summary-generator.js'
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

router.post('/:slug/auto-summary', async (req, res) => {
  try {
    const projectsDir = process.env.PROJECTS_DIR
    if (!projectsDir) {
      return res.status(500).json({ error: 'PROJECTS_DIR not configured' })
    }

    const { slug } = req.params

    // Path traversal protection: validate slug contains no path separators or parent refs
    if (slug.includes('/') || slug.includes('\\') || slug.includes('..')) {
      return res.status(400).json({ error: 'Invalid project slug' })
    }

    // Resolve project directory
    const resolvedProjectsDir = path.resolve(projectsDir)
    const projectPath = path.join(resolvedProjectsDir, slug)

    // Ensure the resolved path is inside PROJECTS_DIR
    if (!projectPath.startsWith(resolvedProjectsDir + path.sep)) {
      return res.status(403).json({ error: 'Access denied' })
    }

    // Check if project directory exists
    try {
      const stats = await fs.stat(projectPath)
      if (!stats.isDirectory()) {
        return res.status(404).json({ error: 'Project not found' })
      }
    } catch {
      return res.status(404).json({ error: 'Project not found' })
    }

    // Generate summary
    const summary = await generateProjectGitSummary(projectPath, slug)

    if (summary === null) {
      return res.json({
        summary: null,
        savedTo: null,
        error: 'No commits in last 7 days, Ollama unavailable, or no git repository'
      })
    }

    return res.json({
      summary,
      savedTo: path.join(projectPath, '.cortex-weekly-summary.md')
    })

  } catch (err) {
    console.error('Failed to generate auto-summary:', err)
    return res.status(500).json({ error: 'Failed to generate summary' })
  }
})

router.get('/:slug/weekly-summary', async (req, res) => {
  try {
    const projectsDir = process.env.PROJECTS_DIR
    if (!projectsDir) {
      return res.status(500).json({ error: 'PROJECTS_DIR not configured' })
    }

    const { slug } = req.params

    // Path traversal protection: validate slug contains no path separators or parent refs
    if (slug.includes('/') || slug.includes('\\') || slug.includes('..')) {
      return res.status(400).json({ error: 'Invalid project slug' })
    }

    // Resolve project directory
    const resolvedProjectsDir = path.resolve(projectsDir)
    const projectPath = path.join(resolvedProjectsDir, slug)

    // Ensure the resolved path is inside PROJECTS_DIR
    if (!projectPath.startsWith(resolvedProjectsDir + path.sep)) {
      return res.status(403).json({ error: 'Access denied' })
    }

    // Try to read the weekly summary file
    const summaryPath = path.join(projectPath, '.cortex-weekly-summary.md')
    try {
      const content = await fs.readFile(summaryPath, 'utf-8')
      return res.json({ content })
    } catch {
      // File doesn't exist
      return res.status(404).json({ error: 'Weekly summary not found' })
    }

  } catch (err) {
    console.error('Failed to fetch weekly summary:', err)
    return res.status(500).json({ error: 'Failed to fetch weekly summary' })
  }
})

router.post('/:slug/context-dump', async (req, res) => {
  try {
    const projectsDir = process.env.PROJECTS_DIR
    if (!projectsDir) {
      return res.status(500).json({ error: 'PROJECTS_DIR not configured' })
    }

    const { slug } = req.params
    const { doing, blocking, next } = req.body

    // Validate required fields
    if (!doing || !blocking || !next) {
      return res.status(400).json({ error: 'Missing required fields: doing, blocking, next' })
    }

    // Path traversal protection: validate slug contains no path separators or parent refs
    if (slug.includes('/') || slug.includes('\\') || slug.includes('..')) {
      return res.status(400).json({ error: 'Invalid project slug' })
    }

    // Resolve project directory
    const resolvedProjectsDir = path.resolve(projectsDir)
    const projectPath = path.join(resolvedProjectsDir, slug)

    // Ensure the resolved path is inside PROJECTS_DIR
    if (!projectPath.startsWith(resolvedProjectsDir + path.sep)) {
      return res.status(403).json({ error: 'Access denied' })
    }

    // Check if project directory exists
    try {
      const stats = await fs.stat(projectPath)
      if (!stats.isDirectory()) {
        return res.status(404).json({ error: 'Project not found' })
      }
    } catch {
      return res.status(404).json({ error: 'Project not found' })
    }

    // Format context dump entry
    const timestamp = new Date().toISOString().replace('T', ' ').substring(0, 16)
    const entry = `## Context Dump — ${timestamp}
**What I was doing**: ${doing}
**What's blocking**: ${blocking}
**What's next**: ${next}
---

`

    // Append to .cortex-context.md
    const contextPath = path.join(projectPath, '.cortex-context.md')
    await fs.appendFile(contextPath, entry, 'utf-8')

    return res.json({
      success: true,
      savedTo: contextPath
    })

  } catch (err) {
    console.error('Failed to save context dump:', err)
    return res.status(500).json({ error: 'Failed to save context dump' })
  }
})

export { router as projectsRouter }
