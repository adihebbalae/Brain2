import { Router } from 'express'
import { readDeadlinesMultiVault, addDeadline, removeDeadline } from '../lib/deadline-reader.js'
import { getVaultDirs } from '../lib/vault-config.js'
import { config } from 'dotenv'

config()

const router = Router()

router.get('/', async (_req, res) => {
  const { VAULT_DIR } = process.env
  if (!VAULT_DIR) {
    return res.status(500).json({ error: 'VAULT_DIR not configured' })
  }
  try {
    const vaultDirs = await getVaultDirs()
    const deadlines = await readDeadlinesMultiVault(vaultDirs)
    return res.json(deadlines)
  } catch (err) {
    console.error('Failed to read deadlines:', err)
    return res.status(500).json({ error: 'Failed to read deadlines' })
  }
})

router.post('/', async (req, res) => {
  const { VAULT_DIR } = process.env
  if (!VAULT_DIR) return res.status(500).json({ error: 'VAULT_DIR not configured' })

  const { date, description, tag } = req.body
  if (!date || typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return res.status(400).json({ error: 'Invalid date. Use YYYY-MM-DD' })
  }
  if (!description || typeof description !== 'string' || !description.trim()) {
    return res.status(400).json({ error: 'Description is required' })
  }

  try {
    const item = await addDeadline(VAULT_DIR, { date, description, tag: tag ?? null })
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

export { router as deadlinesRouter }
