import { Router } from 'express'
import { getYouTubeHistoryData } from '../lib/youtube-history-parser.js'
import { config } from 'dotenv'

config()

const router = Router()

// GET /api/youtube-history - get YouTube watch history
router.get('/youtube-history', async (_req, res) => {
  const { YOUTUBE_HISTORY_PATH } = process.env

  try {
    const data = await getYouTubeHistoryData(YOUTUBE_HISTORY_PATH)
    return res.json(data)
  } catch (err) {
    console.error('Failed to get YouTube history:', err)
    return res.status(500).json({ error: 'Failed to get YouTube history' })
  }
})

export { router as mediaRouter }
