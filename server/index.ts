import express from 'express'
import cors from 'cors'
import { config } from 'dotenv'
import { projectsRouter } from './routes/projects.js'
import { todosRouter } from './routes/todos.js'
import { deadlinesRouter } from './routes/deadlines.js'
import { captureRouter } from './routes/capture.js'
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

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Cortex backend running on http://localhost:${PORT}`)
})

startNotificationService()

export default app
