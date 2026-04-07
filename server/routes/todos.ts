import { Router } from 'express'
import path from 'node:path'
import { extractTodos, toggleTodo } from '../lib/todo-extractor.js'
import { config } from 'dotenv'

config()

const router = Router()

router.get('/', async (_req, res) => {
  const { PROJECTS_DIR, VAULT_DIR } = process.env
  if (!PROJECTS_DIR || !VAULT_DIR) {
    return res.status(500).json({ error: 'PROJECTS_DIR or VAULT_DIR not configured' })
  }
  try {
    const todos = await extractTodos(PROJECTS_DIR, VAULT_DIR)
    const resolvedProjects = path.resolve(PROJECTS_DIR)
    const resolvedVault = path.resolve(VAULT_DIR)
    const safeTodos = {
      ...todos,
      byProject: Object.fromEntries(
        Object.entries(todos.byProject).map(([project, items]) => [
          project,
          items.map(t => {
            const resolvedFile = path.resolve(t.file)
            let relativeFile: string
            if (resolvedFile.startsWith(resolvedProjects + path.sep)) {
              relativeFile = path.relative(resolvedProjects, resolvedFile)
            } else if (resolvedFile.startsWith(resolvedVault + path.sep)) {
              relativeFile = path.relative(resolvedVault, resolvedFile)
            } else {
              relativeFile = path.basename(t.file)
            }
            return { ...t, file: relativeFile }
          }),
        ])
      ),
    }
    return res.json(safeTodos)
  } catch (err) {
    console.error('Failed to extract todos:', err)
    return res.status(500).json({ error: 'Failed to extract todos' })
  }
})

router.patch('/:id', async (req, res) => {
  const { PROJECTS_DIR, VAULT_DIR } = process.env
  const { id } = req.params

  if (!PROJECTS_DIR || !VAULT_DIR) {
    return res.status(500).json({ error: 'PROJECTS_DIR or VAULT_DIR not configured' })
  }

  // Validate id format (16 hex chars)
  if (!/^[0-9a-f]{16}$/.test(id)) {
    return res.status(400).json({ error: 'Invalid todo ID' })
  }

  try {
    await toggleTodo(id, PROJECTS_DIR, VAULT_DIR)
    return res.json({ success: true })
  } catch (err) {
    const error = err as Error
    if (error.message === 'TODO item not found') {
      return res.status(404).json({ error: 'TODO item not found' })
    }
    if (error.message === 'Only checkbox TODOs can be toggled') {
      return res.status(400).json({ error: 'Only checkbox TODOs can be toggled' })
    }
    console.error('Failed to toggle todo:', err)
    return res.status(500).json({ error: 'Failed to toggle todo' })
  }
})

export { router as todosRouter }
