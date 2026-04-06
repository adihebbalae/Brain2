import { Router } from 'express'
import { appendCapture } from '../lib/capture-writer.js'
import { parseNotesCorpus } from '../lib/notes-corpus-parser.js'
import { config } from 'dotenv'

config()

const router = Router()

router.post('/', async (req, res) => {
  const { VAULT_DIR } = process.env
  if (!VAULT_DIR) {
    return res.status(500).json({ error: 'VAULT_DIR not configured' })
  }

  const { text } = req.body as { text?: unknown }

  // Input validation
  if (typeof text !== 'string' || text.trim().length === 0) {
    return res.status(400).json({ error: 'text is required and must be a non-empty string' })
  }
  if (text.length > 2000) {
    return res.status(400).json({ error: 'text must be 2000 characters or fewer' })
  }

  // Sanitize input: strip newlines and control characters (except spaces and tabs)
  const sanitized = text.replace(/\r?\n/g, ' ').replace(/[\x00-\x08\x0B-\x0C\x0E-\x1F\x7F]/g, '')

  try {
    const entry = await appendCapture(sanitized.trim(), VAULT_DIR)
    return res.json({ success: true, entry })
  } catch (err) {
    console.error('Failed to write capture:', err)
    return res.status(500).json({ error: 'Failed to write capture' })
  }
})

router.get('/corpus', async (_req, res) => {
  const corpusPath = process.env.NOTES_CORPUS
  if (!corpusPath) {
    return res.json([])
  }
  try {
    const items = await parseNotesCorpus(corpusPath)
    return res.json(items)
  } catch (err) {
    console.error('Failed to parse corpus:', err)
    return res.json([])
  }
})

export { router as captureRouter }
