import express from 'express'
import cors from 'cors'
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
import { startNotificationService } from './lib/notification-service.js'

config()

const app = express()
const PORT = process.env.PORT || 3001

// Middleware
app.use(cors({ origin: 'http://localhost:5173' }))
app.use(express.json())

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

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Cortex backend running on http://localhost:${PORT}`)
})

// Start notification service (after routes)
startNotificationService()

export default app
