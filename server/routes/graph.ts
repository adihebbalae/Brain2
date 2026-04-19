import { Router } from 'express'
import { parseWikilinkGraph, filterGraphByLimit } from '../lib/wikilink-parser'
import type { GraphData } from '../lib/wikilink-parser'

const router = Router()

/**
 * Cache for the knowledge graph
 * Format: { data: GraphData, totalNotes: number, timestamp: number }
 */
let cache: { data: GraphData; totalNotes: number; timestamp: number } | null = null
const CACHE_DURATION_MS = 5 * 60 * 1000 // 5 minutes

/**
 * GET /api/knowledge-graph?limit=200
 * Returns parsed graph with nodes and edges
 */
router.get('/knowledge-graph', async (req, res) => {
  try {
    // Parse limit parameter
    const limitParam = req.query.limit
    const limit = limitParam ? parseInt(String(limitParam), 10) : 200

    // Validate limit
    if (isNaN(limit) || limit < 1) {
      return res.status(400).json({ error: 'Invalid limit parameter' })
    }

    // Check cache
    const now = Date.now()
    if (cache && (now - cache.timestamp) < CACHE_DURATION_MS) {
      // Cache hit - filter and return
      const filtered = filterGraphByLimit(cache.data, limit)
      return res.json({
        nodes: filtered.nodes,
        edges: filtered.edges,
        totalNotes: cache.totalNotes
      })
    }

    // Cache miss - parse graph
    const graphData = await parseWikilinkGraph()

    // Update cache
    cache = {
      data: graphData,
      totalNotes: graphData.nodes.length,
      timestamp: now
    }

    // Filter and return
    const filtered = filterGraphByLimit(graphData, limit)

    res.json({
      nodes: filtered.nodes,
      edges: filtered.edges,
      totalNotes: cache.totalNotes
    })
  } catch (error) {
    console.error('[graph] Error fetching knowledge graph:', error)
    res.status(500).json({ error: 'Failed to fetch knowledge graph' })
  }
})

export default router
