/**
 * Embedding Index - Local semantic search using nomic-embed-text via Ollama
 * Uses better-sqlite3 with JSON-stored embeddings and pure JS cosine similarity
 * No sqlite-vss dependency (Windows compatibility)
 */

import Database from 'better-sqlite3'
import { promises as fs } from 'node:fs'
import path from 'node:path'
import { getVaultDirs } from './vault-config.js'
import { getOllamaStatus } from './ollama-client.js'

const OLLAMA_URL = process.env.OLLAMA_URL || 'http://localhost:11434'
const EMBEDDING_MODEL = 'nomic-embed-text'
const DB_PATH = path.join(process.cwd(), 'data', 'cortex-embeddings.db')

interface ChunkRow {
  id: number
  filePath: string
  chunkIndex: number
  content: string
  embedding: string  // JSON array of floats
  mtime: number
}

export interface SearchResult {
  filePath: string
  content: string
  score: number
}

interface IndexStatus {
  totalChunks: number
  lastUpdated: string
  isIndexing: boolean
}

let db: Database.Database | null = null
let isIndexing = false
let indexStatus: IndexStatus = {
  totalChunks: 0,
  lastUpdated: 'Never',
  isIndexing: false
}

/**
 * Initialize the SQLite database and create schema if needed
 */
function initDatabase(): Database.Database {
  if (db) return db

  // Ensure data directory exists
  const dataDir = path.dirname(DB_PATH)
  try {
    require('fs').mkdirSync(dataDir, { recursive: true })
  } catch (err) {
    // Directory may already exist
  }

  db = new Database(DB_PATH)

  // Create schema
  db.exec(`
    CREATE TABLE IF NOT EXISTS chunks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      filePath TEXT NOT NULL,
      chunkIndex INTEGER NOT NULL,
      content TEXT NOT NULL,
      embedding TEXT NOT NULL,
      mtime REAL NOT NULL,
      UNIQUE(filePath, chunkIndex)
    )
  `)

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_filePath ON chunks(filePath)
  `)

  return db
}

/**
 * Chunk text by paragraph boundaries with overlap
 */
export function chunkText(text: string, maxChars: number = 500): string[] {
  const chunks: string[] = []
  const paragraphs = text.split(/\n\n+/)

  let currentChunk = ''
  let previousOverlap = ''

  for (const paragraph of paragraphs) {
    const trimmed = paragraph.trim()
    if (!trimmed) continue

    // If paragraph fits in current chunk, add it
    if ((currentChunk + '\n\n' + trimmed).length <= maxChars) {
      currentChunk = currentChunk ? currentChunk + '\n\n' + trimmed : trimmed
    } else {
      // Save current chunk if it has content
      if (currentChunk) {
        chunks.push(currentChunk)
        // Keep last 50 chars for overlap
        previousOverlap = currentChunk.slice(-50)
      }

      // If paragraph itself is too large, split further
      if (trimmed.length > maxChars) {
        const lines = trimmed.split(/\n/)
        for (const line of lines) {
          if (line.length > maxChars) {
            // Split by sentences
            const sentences = line.split(/\.\s+/)
            for (const sentence of sentences) {
              if ((currentChunk + sentence).length > maxChars) {
                if (currentChunk) {
                  chunks.push(currentChunk)
                  previousOverlap = currentChunk.slice(-50)
                }
                currentChunk = previousOverlap + sentence
              } else {
                currentChunk = currentChunk ? currentChunk + '. ' + sentence : sentence
              }
            }
          } else {
            if ((currentChunk + '\n' + line).length > maxChars) {
              if (currentChunk) {
                chunks.push(currentChunk)
                previousOverlap = currentChunk.slice(-50)
              }
              currentChunk = previousOverlap + line
            } else {
              currentChunk = currentChunk ? currentChunk + '\n' + line : line
            }
          }
        }
      } else {
        // Start new chunk with overlap
        currentChunk = previousOverlap + trimmed
      }
    }
  }

  // Add final chunk
  if (currentChunk) {
    chunks.push(currentChunk)
  }

  return chunks.length > 0 ? chunks : [text.slice(0, maxChars)]
}

/**
 * Get embedding for text from Ollama
 */
async function getEmbedding(text: string): Promise<number[] | null> {
  try {
    const response = await fetch(`${OLLAMA_URL}/api/embeddings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: EMBEDDING_MODEL,
        prompt: text
      })
    })

    if (!response.ok) {
      console.error(`[embeddings] Failed to get embedding: HTTP ${response.status}`)
      return null
    }

    const data = await response.json()
    return data.embedding || null
  } catch (err) {
    console.error('[embeddings] Error fetching embedding:', err)
    return null
  }
}

/**
 * Compute cosine similarity between two vectors
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) return 0

  let dot = 0
  let magA = 0
  let magB = 0

  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i]
    magA += a[i] * a[i]
    magB += b[i] * b[i]
  }

  const magnitude = Math.sqrt(magA) * Math.sqrt(magB)
  return magnitude === 0 ? 0 : dot / magnitude
}

/**
 * Scan vault and projects directories for markdown files
 */
async function scanMarkdownFiles(): Promise<Map<string, number>> {
  const files = new Map<string, number>()

  // Scan vault directories
  const vaultDirs = await getVaultDirs()
  for (const vaultDir of vaultDirs) {
    try {
      await fs.access(vaultDir)
    } catch {
      continue // Skip non-existent vaults
    }

    await walkDirectory(vaultDir, files)
  }

  // Scan projects directory
  const projectsDir = process.env.PROJECTS_DIR
  if (projectsDir) {
    try {
      await fs.access(projectsDir)
      await walkDirectory(projectsDir, files)
    } catch {
      // Projects dir doesn't exist
    }
  }

  return files
}

/**
 * Recursively walk directory and collect .md files with mtimes
 */
async function walkDirectory(dir: string, files: Map<string, number>): Promise<void> {
  try {
    const entries = await fs.readdir(dir, { withFileTypes: true })

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name)

      if (entry.isDirectory()) {
        // Skip hidden directories, node_modules, .git
        if (entry.name.startsWith('.') || entry.name === 'node_modules') continue
        await walkDirectory(fullPath, files)
      } else if (entry.isFile() && entry.name.endsWith('.md')) {
        try {
          const stat = await fs.stat(fullPath)
          files.set(fullPath, stat.mtimeMs)
        } catch (err) {
          console.error(`[embeddings] Failed to stat ${fullPath}:`, err)
        }
      }
    }
  } catch (err) {
    console.error(`[embeddings] Failed to walk ${dir}:`, err)
  }
}

/**
 * Get files that need re-embedding (new or changed)
 */
function getFilesToUpdate(currentFiles: Map<string, number>): string[] {
  const database = initDatabase()
  const filesToUpdate: string[] = []

  // Get all existing file paths and mtimes from database
  const existing = database.prepare('SELECT DISTINCT filePath, MAX(mtime) as mtime FROM chunks GROUP BY filePath').all() as { filePath: string, mtime: number }[]
  const existingMap = new Map(existing.map(row => [row.filePath, row.mtime]))

  // Check each current file
  for (const [filePath, mtime] of currentFiles) {
    const existingMtime = existingMap.get(filePath)
    if (!existingMtime || existingMtime < mtime) {
      filesToUpdate.push(filePath)
    }
  }

  return filesToUpdate
}

/**
 * Embed a single file and store chunks in database
 */
async function embedFile(filePath: string, mtime: number): Promise<number> {
  const database = initDatabase()

  try {
    // Read file content
    const content = await fs.readFile(filePath, 'utf-8')

    // Skip empty files
    if (!content.trim()) return 0

    // Chunk the content
    const chunks = chunkText(content)

    // Delete existing chunks for this file
    database.prepare('DELETE FROM chunks WHERE filePath = ?').run(filePath)

    // Embed each chunk
    let embedded = 0
    const insertStmt = database.prepare(
      'INSERT INTO chunks (filePath, chunkIndex, content, embedding, mtime) VALUES (?, ?, ?, ?, ?)'
    )

    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i]
      const embedding = await getEmbedding(chunk)

      if (embedding) {
        insertStmt.run(
          filePath,
          i,
          chunk,
          JSON.stringify(embedding),
          mtime
        )
        embedded++
      }
    }

    return embedded
  } catch (err) {
    console.error(`[embeddings] Failed to embed file ${filePath}:`, err)
    return 0
  }
}

/**
 * Initialize the embedding index (called on server startup)
 * Runs in background, non-blocking
 */
export async function initializeIndex(): Promise<void> {
  // Don't run during tests
  if (process.env.NODE_ENV === 'test') {
    console.log('[embeddings] Skipping index initialization in test mode')
    return
  }

  // Check if already indexing
  if (isIndexing) {
    console.log('[embeddings] Index initialization already in progress')
    return
  }

  // Check if Ollama is available
  const status = await getOllamaStatus()
  if (!status.available) {
    console.warn('[embeddings] Ollama not available - skipping index initialization')
    return
  }

  isIndexing = true
  indexStatus.isIndexing = true

  // Run indexing in background (async, non-blocking)
  setImmediate(async () => {
    try {
      console.log('[embeddings] Starting index initialization...')

      // Initialize database
      initDatabase()

      // Scan for markdown files
      const currentFiles = await scanMarkdownFiles()
      console.log(`[embeddings] Found ${currentFiles.size} markdown files`)

      // Determine which files need updating
      const filesToUpdate = getFilesToUpdate(currentFiles)
      console.log(`[embeddings] ${filesToUpdate.length} files need embedding`)

      if (filesToUpdate.length === 0) {
        console.log('[embeddings] Index is up to date')
        isIndexing = false
        indexStatus.isIndexing = false
        updateIndexStatus()
        return
      }

      // Embed files with progress logging
      let processed = 0
      for (const filePath of filesToUpdate) {
        const mtime = currentFiles.get(filePath)!
        await embedFile(filePath, mtime)
        processed++

        // Log progress every 10 files
        if (processed % 10 === 0 || processed === filesToUpdate.length) {
          console.log(`[embeddings] Indexing ${processed}/${filesToUpdate.length} files...`)
        }
      }

      console.log('[embeddings] Index initialization complete')
      updateIndexStatus()
    } catch (err) {
      console.error('[embeddings] Index initialization failed:', err)
    } finally {
      isIndexing = false
      indexStatus.isIndexing = false
    }
  })
}

/**
 * Update index status cache
 */
function updateIndexStatus(): void {
  const database = initDatabase()
  const result = database.prepare('SELECT COUNT(*) as count FROM chunks').get() as { count: number }
  indexStatus = {
    totalChunks: result.count,
    lastUpdated: new Date().toISOString(),
    isIndexing: false
  }
}

/**
 * Search using semantic similarity
 */
export async function searchSemantic(query: string, limit: number = 20): Promise<SearchResult[]> {
  try {
    // Check if Ollama is available
    const status = await getOllamaStatus()
    if (!status.available) {
      console.warn('[embeddings] Ollama not available for semantic search')
      return []
    }

    // Get query embedding
    const queryEmbedding = await getEmbedding(query)
    if (!queryEmbedding) {
      console.warn('[embeddings] Failed to get query embedding')
      return []
    }

    // Get all chunks from database
    const database = initDatabase()
    const chunks = database.prepare('SELECT filePath, content, embedding FROM chunks').all() as ChunkRow[]

    if (chunks.length === 0) {
      return []
    }

    // Compute similarity for each chunk
    const scored = chunks.map(chunk => {
      const embedding = JSON.parse(chunk.embedding) as number[]
      const score = cosineSimilarity(queryEmbedding, embedding)
      return {
        filePath: chunk.filePath,
        content: chunk.content,
        score
      }
    })

    // Sort by score descending and take top N
    scored.sort((a, b) => b.score - a.score)
    return scored.slice(0, limit)
  } catch (err) {
    console.error('[embeddings] Semantic search failed:', err)
    return []
  }
}

/**
 * Get index status
 */
export function getIndexStatus(): IndexStatus {
  if (!db) {
    return {
      totalChunks: 0,
      lastUpdated: 'Never',
      isIndexing: false
    }
  }

  const database = initDatabase()
  const result = database.prepare('SELECT COUNT(*) as count FROM chunks').get() as { count: number }

  return {
    totalChunks: result.count,
    lastUpdated: indexStatus.lastUpdated,
    isIndexing: indexStatus.isIndexing
  }
}

/**
 * Close database connection (for cleanup)
 */
export function closeDatabase(): void {
  if (db) {
    db.close()
    db = null
  }
}
