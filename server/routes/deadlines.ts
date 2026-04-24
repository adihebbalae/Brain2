import { Router } from 'express'
import { readDeadlinesMultiVault, addDeadline, removeDeadline, updateDeadline, DeadlineItem } from '../lib/deadline-reader.js'
import { getVaultDirs } from '../lib/vault-config.js'
import { extractTodosMultiVault } from '../lib/todo-extractor.js'
import { getVelocityDataAsync, getWeeklyAverage } from '../lib/velocity-tracker.js'
import { config } from 'dotenv'

config()

const router = Router()

/**
 * Calculate risk score for a deadline
 * riskScore = remainingTodos / (avgTodosCompletedPerWeek * weeksUntilDeadline)
 * Returns null if not enough data or deadline has no associated project
 */
async function calculateRiskScore(
  deadline: DeadlineItem,
  projectTodos: Record<string, number>,
  avgTodosPerWeek: number
): Promise<number | null> {
  // Skip completed deadlines
  if (deadline.done) return null

  // Skip if no tag (can't match to project)
  if (!deadline.tag) return null

  // Get remaining todos for this project (match by tag)
  const remainingTodos = projectTodos[deadline.tag] || 0

  // Calculate weeks until deadline
  const weeksUntilDeadline = deadline.daysUntil / 7

  // Need at least some velocity data and positive time remaining
  if (avgTodosPerWeek === 0 || weeksUntilDeadline <= 0) return null

  // Calculate risk score
  const riskScore = remainingTodos / (avgTodosPerWeek * weeksUntilDeadline)

  return riskScore
}

router.get('/', async (_req, res) => {
  const { VAULT_DIR, PROJECTS_DIR } = process.env
  if (!VAULT_DIR) {
    return res.status(500).json({ error: 'VAULT_DIR not configured' })
  }
  if (!PROJECTS_DIR) {
    return res.status(500).json({ error: 'PROJECTS_DIR not configured' })
  }

  try {
    const vaultDirs = await getVaultDirs()
    const deadlines = await readDeadlinesMultiVault(vaultDirs)

    // Get velocity data to calculate risk scores
    let avgTodosPerWeek = 0
    try {
      const velocityData = await getVelocityDataAsync(30) // Use last 30 days for average
      const weeklyAvg = getWeeklyAverage(velocityData)
      avgTodosPerWeek = weeklyAvg.todosPerWeek
    } catch (error) {
      console.warn('[deadlines] Failed to get velocity data for risk scores:', error)
    }

    // Get TODO counts by project
    let projectTodos: Record<string, number> = {}
    try {
      const todosResult = await extractTodosMultiVault(PROJECTS_DIR, vaultDirs)
      // Count open TODOs by project
      for (const [project, todos] of Object.entries(todosResult.byProject)) {
        projectTodos[project] = todos.filter(t => !t.done).length
      }
    } catch (error) {
      console.warn('[deadlines] Failed to get TODOs for risk scores:', error)
    }

    // Calculate risk scores
    const deadlinesWithRisk = await Promise.all(
      deadlines.map(async (deadline) => {
        const riskScore = await calculateRiskScore(deadline, projectTodos, avgTodosPerWeek)
        return {
          ...deadline,
          riskScore,
        }
      })
    )

    return res.json(deadlinesWithRisk)
  } catch (err) {
    console.error('Failed to read deadlines:', err)
    return res.status(500).json({ error: 'Failed to read deadlines' })
  }
})

router.post('/', async (req, res) => {
  const { VAULT_DIR } = process.env
  if (!VAULT_DIR) return res.status(500).json({ error: 'VAULT_DIR not configured' })

  const { date, description, tag, notes } = req.body
  if (!date || typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return res.status(400).json({ error: 'Invalid date. Use YYYY-MM-DD' })
  }
  if (!description || typeof description !== 'string' || !description.trim()) {
    return res.status(400).json({ error: 'Description is required' })
  }

  try {
    const item = await addDeadline(VAULT_DIR, {
      date,
      description,
      tag: tag ?? null,
      notes: (typeof notes === 'string' && notes.trim()) ? notes : null,
    })
    return res.status(201).json(item)
  } catch (err) {
    console.error('Failed to add deadline:', err)
    return res.status(500).json({ error: 'Failed to add deadline' })
  }
})

router.delete('/:id', async (req, res) => {
  const { VAULT_DIR } = process.env
  if (!VAULT_DIR) return res.status(500).json({ error: 'VAULT_DIR not configured' })

  const { id } = req.params
  if (!/^[a-f0-9]{12}$/.test(id)) {
    return res.status(400).json({ error: 'Invalid deadline ID' })
  }

  try {
    const vaultDirs = await getVaultDirs()
    const removed = await removeDeadline(vaultDirs, id)
    if (!removed) return res.status(404).json({ error: 'Deadline not found' })
    return res.json({ success: true })
  } catch (err) {
    console.error('Failed to delete deadline:', err)
    return res.status(500).json({ error: 'Failed to delete deadline' })
  }
})

router.put('/:id', async (req, res) => {
  const { VAULT_DIR } = process.env
  if (!VAULT_DIR) return res.status(500).json({ error: 'VAULT_DIR not configured' })

  const { id } = req.params
  if (!/^[a-f0-9]{12}$/.test(id)) {
    return res.status(400).json({ error: 'Invalid deadline ID' })
  }

  const { date, description, tag, notes, done } = req.body
  if (date !== undefined && (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date))) {
    return res.status(400).json({ error: 'Invalid date. Use YYYY-MM-DD' })
  }
  if (description !== undefined && (typeof description !== 'string' || !description.trim())) {
    return res.status(400).json({ error: 'Description cannot be empty' })
  }

  const updates: Record<string, unknown> = {}
  if (date !== undefined) updates.date = date
  if (description !== undefined) updates.description = description
  if (tag !== undefined) updates.tag = tag ?? null
  if (notes !== undefined) updates.notes = (typeof notes === 'string' && notes.trim()) ? notes : null
  if (done !== undefined) updates.done = Boolean(done)

  try {
    const vaultDirs = await getVaultDirs()
    const updated = await updateDeadline(vaultDirs, id, updates)
    if (!updated) return res.status(404).json({ error: 'Deadline not found' })
    return res.json(updated)
  } catch (err) {
    console.error('Failed to update deadline:', err)
    return res.status(500).json({ error: 'Failed to update deadline' })
  }
})

export { router as deadlinesRouter }
