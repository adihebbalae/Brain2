import { Router } from 'express'
import { readDeadlines } from '../lib/deadline-reader.js'
import { config } from 'dotenv'

config()

const router = Router()

router.get('/', async (_req, res) => {
  const { VAULT_DIR } = process.env
  if (!VAULT_DIR) {
    return res.status(500).json({ error: 'VAULT_DIR not configured' })
  }
  try {
    const deadlines = await readDeadlines(VAULT_DIR)
    return res.json(deadlines)
  } catch (err) {
    console.error('Failed to read deadlines:', err)
    return res.status(500).json({ error: 'Failed to read deadlines' })
  }
})

export { router as deadlinesRouter }
