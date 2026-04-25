/**
 * Unified search endpoint with semantic and keyword modes
 */

import { Router } from 'express'
import { searchSemantic, getIndexStatus } from '../lib/embedding-index.js'
import { buildIndex, scoreChunks } from '../lib/rag-engine.js'

const router = Router()

interface SearchResponse {
  results: Array<{
    filePath: string
    content: string
    score: number
  }>
  mode: 'semantic' | 'keyword'
  fallback?: boolean
}

/**
 * GET /api/search?q={query}&mode=semantic|keyword&limit=20
 *
 * Returns search results using either semantic (embeddings) or keyword (RAG) search
 * Falls back to keyword mode if embeddings unavailable
 */
router.get('/', async (req, res) => {
  const query = req.query.q as string
  const requestedMode = (req.query.mode as string) || 'semantic'
  const limit = parseInt(req.query.limit as string) || 20

  if (!query || typeof query !== 'string') {
    return res.status(400).json({ error: 'Missing or invalid query parameter' })
  }

  try {
    let results: SearchResponse['results'] = []
    let actualMode: 'semantic' | 'keyword' = requestedMode as 'semantic' | 'keyword'
    let fallback = false

    if (requestedMode === 'semantic') {
      // Try semantic search first
      const semanticResults = await searchSemantic(query, limit)

      if (semanticResults.length > 0) {
        results = semanticResults
        actualMode = 'semantic'
      } else {
        // Fallback to keyword search
        console.log('[search] Semantic search returned no results, falling back to keyword')
        const index = await buildIndex()
        const chunks = scoreChunks(query, index, limit)
        results = chunks.map(chunk => ({
          filePath: chunk.metadata?.path || chunk.title,
          content: chunk.content,
          score: 0 // Keyword search doesn't provide scores
        }))
        actualMode = 'keyword'
        fallback = true
      }
    } else {
      // Use keyword search
      const index = await buildIndex()
      const chunks = scoreChunks(query, index, limit)
      results = chunks.map(chunk => ({
        filePath: chunk.metadata?.path || chunk.title,
        content: chunk.content,
        score: 0
      }))
      actualMode = 'keyword'
    }

    const response: SearchResponse = {
      results,
      mode: actualMode
    }

    if (fallback) {
      response.fallback = true
    }

    res.json(response)
  } catch (err) {
    console.error('[search] Search failed:', err)
    res.status(500).json({ error: 'Search failed' })
  }
})

/**
 * GET /api/search/status
 *
 * Returns embedding index status
 */
router.get('/status', (req, res) => {
  const status = getIndexStatus()
  res.json(status)
})

export const searchRouter = router
