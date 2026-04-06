import express from 'express'
import cors from 'cors'
import { config } from 'dotenv'
import { projectsRouter } from './routes/projects.js'
import { todosRouter } from './routes/todos.js'

config()

const app = express()
const PORT = process.env.PORT || 3001

// Middleware
app.use(cors())
app.use(express.json())

// Health check
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
})

// API Routes
app.use('/api/projects', projectsRouter)
app.use('/api/todos', todosRouter)

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Cortex backend running on http://localhost:${PORT}`)
})

export default app
