import { Router } from 'express'
import path from 'node:path'
import { extractTodosMultiVault, TodoItem } from '../lib/todo-extractor.js'
import { getVaultDirs } from '../lib/vault-config.js'
import { config } from 'dotenv'

config()

const router = Router()

interface KanbanData {
  todo: TodoItem[]
  doing: TodoItem[]
  done: TodoItem[]
}

router.get('/', async (_req, res) => {
  const { PROJECTS_DIR, VAULT_DIR } = process.env
  if (!PROJECTS_DIR || !VAULT_DIR) {
    return res.status(500).json({ error: 'PROJECTS_DIR or VAULT_DIR not configured' })
  }

  try {
    const vaultDirs = await getVaultDirs()
    const todos = await extractTodosMultiVault(PROJECTS_DIR, vaultDirs)

    // Flatten all todos and group by status
    const allTodos = Object.values(todos.byProject).flat()

    // Only include checkbox items (not TODO: comments, FIXME, etc.)
    const checkboxTodos = allTodos.filter(t => t.type === 'checkbox')

    const kanbanData: KanbanData = {
      todo: checkboxTodos.filter(t => t.status === 'todo'),
      doing: checkboxTodos.filter(t => t.status === 'doing'),
      done: checkboxTodos.filter(t => t.status === 'done')
    }

    // Convert absolute paths to relative paths
    const resolvedProjects = path.resolve(PROJECTS_DIR)

    const sanitizeTodos = (items: TodoItem[]) => items.map(t => {
      const resolvedFile = path.resolve(t.file)
      let relativeFile: string
      if (resolvedFile.startsWith(resolvedProjects + path.sep)) {
        relativeFile = path.relative(resolvedProjects, resolvedFile)
      } else {
        // Try to find which vault dir contains this file
        const containingVault = vaultDirs.find(vaultDir =>
          resolvedFile.startsWith(path.resolve(vaultDir) + path.sep)
        )
        if (containingVault) {
          relativeFile = path.relative(path.resolve(containingVault), resolvedFile)
        } else {
          relativeFile = path.basename(t.file)
        }
      }
      return { ...t, file: relativeFile }
    })

    const safeKanbanData = {
      todo: sanitizeTodos(kanbanData.todo),
      doing: sanitizeTodos(kanbanData.doing),
      done: sanitizeTodos(kanbanData.done)
    }

    return res.json(safeKanbanData)
  } catch (err) {
    console.error('Failed to extract kanban data:', err)
    return res.status(500).json({ error: 'Failed to extract kanban data' })
  }
})

export { router as kanbanRouter }
