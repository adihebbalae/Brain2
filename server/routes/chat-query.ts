/**
 * Chat query route with RAG context assembly and Ollama streaming
 */

import express from 'express'
import { smartSearch, assembleContext, getUniqueSources } from '../lib/rag-engine.js'
import { getOllamaStatus } from '../lib/ollama-client.js'

const router = express.Router()

const OLLAMA_URL = process.env.OLLAMA_URL || 'http://localhost:11434'
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'llama3.1:8b'
const OLLAMA_KEEP_ALIVE = process.env.OLLAMA_KEEP_ALIVE || '30m'

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

interface ChatQueryBody {
  message: string
  history?: ChatMessage[]
  mode?: 'semantic' | 'keyword'
}

/**
 * POST /api/chat/query
 * Body: { message: string, history?: {role: 'user'|'assistant', content: string}[] }
 * Returns: SSE stream with Ollama response
 */
router.post('/query', async (req, res) => {
  const { message, history = [], mode = 'semantic' } = req.body as ChatQueryBody

  // Validate input
  if (!message || typeof message !== 'string' || message.trim().length === 0) {
    res.status(400).json({ error: 'Message is required' })
    return
  }

  // Check if Ollama is available
  const status = await getOllamaStatus()
  if (!status.available) {
    res.status(503).json({ error: 'Ollama not running — start it with: ollama serve' })
    return
  }

  try {
    // Use smart search (semantic + keyword fallback) or force keyword mode
    let topChunks
    if (mode === 'keyword') {
      // Force keyword mode
      const { buildIndex, scoreChunks } = await import('../lib/rag-engine.js')
      const index = await buildIndex()
      topChunks = scoreChunks(message, index, 20)
    } else {
      // Semantic mode with automatic fallback
      topChunks = await smartSearch(message, 20)
    }
    const context = assembleContext(topChunks, 6000)
    const sources = getUniqueSources(topChunks)

    // Build conversation history (last 3 turns)
    const recentHistory = history.slice(-6) // Last 3 pairs (6 messages)
    const historyText = recentHistory
      .map(msg => `${msg.role === 'user' ? 'User' : 'Assistant'}: ${msg.content}`)
      .join('\n\n')

    // Build Ollama prompt
    const prompt = `You are an AI assistant for a personal knowledge dashboard called Cortex. Answer questions based on the provided context from the user's notes, projects, and knowledge base.

Context:
${context || '(No relevant context found)'}

${historyText ? `Conversation history:\n${historyText}\n\n` : ''}User: ${message}
Assistant:`

    // Set up SSE headers
    res.setHeader('Content-Type', 'text/event-stream')
    res.setHeader('Cache-Control', 'no-cache')
    res.setHeader('Connection', 'keep-alive')
    res.flushHeaders()

    // Send sources as first event
    res.write(`data: ${JSON.stringify({ sources })}\n\n`)

    // Call Ollama with streaming
    const ollamaResponse = await fetch(`${OLLAMA_URL}/api/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: OLLAMA_MODEL,
        prompt,
        stream: true,
        keep_alive: OLLAMA_KEEP_ALIVE,
      }),
    })

    if (!ollamaResponse.ok) {
      res.write(`data: ${JSON.stringify({ error: `Ollama API error: ${ollamaResponse.status}` })}\n\n`)
      res.write('data: [DONE]\n\n')
      res.end()
      return
    }

    // Stream Ollama's NDJSON response as SSE
    const reader = ollamaResponse.body?.getReader()
    if (!reader) {
      res.write(`data: ${JSON.stringify({ error: 'Failed to read Ollama stream' })}\n\n`)
      res.write('data: [DONE]\n\n')
      res.end()
      return
    }

    const decoder = new TextDecoder()
    let buffer = ''

    while (true) {
      const { done, value } = await reader.read()

      if (done) break

      // Decode chunk and add to buffer
      buffer += decoder.decode(value, { stream: true })

      // Process complete lines (NDJSON)
      const lines = buffer.split('\n')
      buffer = lines.pop() || '' // Keep incomplete line in buffer

      for (const line of lines) {
        if (!line.trim()) continue

        try {
          const data = JSON.parse(line)

          if (data.response) {
            // Send token as SSE event
            res.write(`data: ${JSON.stringify({ chunk: data.response })}\n\n`)
          }

          if (data.done) {
            // Stream complete
            res.write('data: [DONE]\n\n')
            res.end()
            return
          }
        } catch (err) {
          console.error('Failed to parse Ollama line:', line, err)
        }
      }
    }

    // If we exit the loop without seeing done=true
    res.write('data: [DONE]\n\n')
    res.end()
  } catch (error) {
    console.error('Chat query error:', error)
    res.write(`data: ${JSON.stringify({ error: 'Internal server error' })}\n\n`)
    res.write('data: [DONE]\n\n')
    res.end()
  }
})

export default router
