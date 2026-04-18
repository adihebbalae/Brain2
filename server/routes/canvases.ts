import { Router } from 'express'
import path from 'node:path'
import { promises as fs } from 'node:fs'
import { parseCanvas, addNodeToCanvas } from '../lib/canvas-parser.js'
import { getPrimaryVaultDir } from '../lib/vault-config.js'
import type { CanvasData } from '../lib/canvas-parser.js'

const router = Router()

// Cache for canvas list (3 minutes)
let cachedCanvases: CanvasData[] | null = null
let cacheTimestamp = 0
const CACHE_DURATION_MS = 3 * 60 * 1000 // 3 minutes

/**
 * Recursively finds all .canvas files in a directory
 */
async function findCanvasFiles(dir: string): Promise<string[]> {
  const result: string[] = []

  try {
    const entries = await fs.readdir(dir, { withFileTypes: true })

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name)

      if (entry.isDirectory()) {
        // Recurse into subdirectories
        const subFiles = await findCanvasFiles(fullPath)
        result.push(...subFiles)
      } else if (entry.isFile() && entry.name.endsWith('.canvas')) {
        result.push(fullPath)
      }
    }
  } catch (err) {
    console.error(`[canvases] Error scanning directory ${dir}:`, err)
  }

  return result
}

/**
 * GET /api/canvases
 * Scans VAULT_DIR for all .canvas files and returns parsed metadata.
 * Results are cached for 3 minutes.
 */
router.get('/', async (_req, res) => {
  try {
    const vaultDir = getPrimaryVaultDir()

    // Check cache
    const now = Date.now()
    if (cachedCanvases && (now - cacheTimestamp) < CACHE_DURATION_MS) {
      return res.json(cachedCanvases)
    }

    // Find all .canvas files
    const canvasFiles = await findCanvasFiles(vaultDir)

    // Parse each canvas file
    const canvases: CanvasData[] = []
    for (const filePath of canvasFiles) {
      const parsed = await parseCanvas(filePath, vaultDir)
      if (parsed) {
        canvases.push(parsed)
      }
    }

    // Sort by lastModified descending
    canvases.sort((a, b) => {
      return new Date(b.lastModified).getTime() - new Date(a.lastModified).getTime()
    })

    // Update cache
    cachedCanvases = canvases
    cacheTimestamp = now

    return res.json(canvases)
  } catch (err) {
    console.error('[canvases] Error scanning canvas files:', err)
    return res.status(500).json({ error: 'Failed to scan canvas files' })
  }
})

/**
 * POST /api/canvases/:filename/add-node
 * Adds a new text node to the specified canvas file.
 * Body: { text: string, color?: string }
 */
router.post('/:filename/add-node', async (req, res) => {
  try {
    const vaultDir = getPrimaryVaultDir()
    const { filename } = req.params
    const { text, color } = req.body

    // Validate input
    if (!text || typeof text !== 'string' || !text.trim()) {
      return res.status(400).json({ error: 'Text is required' })
    }

    // Validate color if provided
    if (color && !['1', '2', '3', '4', '5', '6'].includes(color)) {
      return res.status(400).json({ error: 'Invalid color code' })
    }

    // Find the canvas file (need to search recursively since we only have filename)
    const canvasFiles = await findCanvasFiles(vaultDir)
    const matchingFile = canvasFiles.find(f => {
      const basename = path.basename(f, '.canvas')
      return basename === filename
    })

    if (!matchingFile) {
      return res.status(404).json({ error: 'Canvas file not found' })
    }

    // Path traversal protection: ensure the resolved file is within vault
    const resolvedFile = path.resolve(matchingFile)
    const resolvedVault = path.resolve(vaultDir)
    if (!resolvedFile.startsWith(resolvedVault + path.sep)) {
      return res.status(403).json({ error: 'Path traversal not allowed' })
    }

    // Add the node
    await addNodeToCanvas(resolvedFile, text.trim(), color)

    // Invalidate cache
    cachedCanvases = null

    return res.json({ success: true, filename })
  } catch (err) {
    console.error('[canvases] Error adding node to canvas:', err)
    const error = err as Error
    if (error.message.includes('Invalid canvas structure')) {
      return res.status(400).json({ error: error.message })
    }
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return res.status(404).json({ error: 'Canvas file not found' })
    }
    return res.status(500).json({ error: 'Failed to add node to canvas' })
  }
})

/**
 * Clear the canvas cache (for testing)
 */
export function clearCanvasCache() {
  cachedCanvases = null
  cacheTimestamp = 0
}

export { router as canvasesRouter }
