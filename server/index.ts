import express from 'express'
import cors from 'cors'
import path from 'path'
import { fileURLToPath } from 'url'
import { config } from 'dotenv'
import { projectsRouter } from './routes/projects.js'
import { todosRouter } from './routes/todos.js'
import { deadlinesRouter } from './routes/deadlines.js'
import { captureRouter } from './routes/capture.js'
import { aiRouter } from './routes/ai.js'
import { chatsRouter } from './routes/chats.js'
import { wikiRouter } from './routes/wiki.js'
import { calendarRouter } from './routes/calendar.js'
import { mediaRouter } from './routes/media.js'
import readingRouter from './routes/reading.js'
import graphRouter from './routes/graph.js'
import { activityRouter } from './routes/activity.js'
import { canvasesRouter } from './routes/canvases.js'
import { reviewRouter } from './routes/review.js'
import { dailyRouter } from './routes/daily.js'
import { weeklyRouter, autoTriggerWeeklyReview } from './routes/weekly.js'
import chatQueryRouter from './routes/chat-query.js'
import { startNotificationService } from './lib/notification-service.js'
import { syncNewNotes } from './lib/review-log.js'
import { getPrimaryVaultDir } from './lib/vault-config.js'

config()

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const app = express()
const PORT = process.env.PORT || 3001

// Middleware
app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (like mobile apps or Postman)
    if (!origin) return callback(null, true);

    // Allow localhost:5173 (frontend dev server)
    if (origin === 'http://localhost:5173') return callback(null, true);

    // Allow chrome-extension:// origins
    if (origin.startsWith('chrome-extension://')) return callback(null, true);

    // Reject all other origins
    callback(new Error('Not allowed by CORS'));
  }
}))
app.use(express.json())

// Serve static files in production (Electron mode)
if (process.env.SERVE_STATIC === 'true') {
  const distPath = path.join(__dirname, '../dist')
  app.use(express.static(distPath))
}

// Health check
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
})

// API Routes
app.use('/api/projects', projectsRouter)
app.use('/api/todos', todosRouter)
app.use('/api/deadlines', deadlinesRouter)
app.use('/api/capture', captureRouter)
app.use('/api/ai', aiRouter)
app.use('/api/chats', chatsRouter)
app.use('/api/wiki', wikiRouter)
app.use('/api/calendar', calendarRouter)
app.use('/api', mediaRouter)
app.use('/api/reading', readingRouter)
app.use('/api', graphRouter)
app.use('/api', activityRouter)
app.use('/api/canvases', canvasesRouter)
app.use('/api/review', reviewRouter)
app.use('/api', dailyRouter)
app.use('/api', weeklyRouter)
app.use('/api/chat', chatQueryRouter)

// SPA fallback - serve index.html for non-API routes in production
if (process.env.SERVE_STATIC === 'true') {
  app.get('*', (_req, res) => {
    const distPath = path.join(__dirname, '../dist')
    res.sendFile(path.join(distPath, 'index.html'))
  })
}

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Cortex backend running on http://localhost:${PORT}`)
})

// Start notification service (after routes)
startNotificationService()

// Sync review log with vault notes (non-blocking)
try {
  const vaultDir = getPrimaryVaultDir()
  syncNewNotes(vaultDir).catch(err => {
    console.error('[startup] Failed to sync review log:', err)
  })
} catch (err) {
  console.error('[startup] Failed to get vault dir for review log sync:', err)
}

// Auto-trigger weekly review on Sunday (non-blocking, 5-second delay)
if (process.env.NODE_ENV !== 'test') {
  setTimeout(() => {
    autoTriggerWeeklyReview().catch(err => {
      console.error('[startup] Failed to auto-trigger weekly review:', err)
    })
  }, 5000)
}

export default app
