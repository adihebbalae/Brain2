/**
 * RAG (Retrieval-Augmented Generation) Engine
 * Keyword-based context assembly from all Cortex data sources
 * No vector embeddings - fast, lightweight, no extra dependencies
 */

import { promises as fs } from 'node:fs'
import path from 'node:path'
import { scanProjects } from './scanner.js'
import { listConversations } from './chat-export-parser.js'
import { listPages } from './wiki-manager.js'
import { parseReadingLog } from './reading-log-parser.js'
import { getVaultDirs, getPrimaryVaultDir } from './vault-config.js'

export interface Chunk {
  id: string
  source: 'notes' | 'projects' | 'chats' | 'wiki' | 'reading'
  title: string
  content: string    // max 500 chars per chunk
  metadata?: Record<string, string>
}

interface ScoredChunk {
  chunk: Chunk
  score: number
}

/**
 * Common English stopwords to filter out
 */
const STOPWORDS = new Set([
  'a', 'an', 'and', 'are', 'as', 'at', 'be', 'by', 'for', 'from',
  'has', 'he', 'in', 'is', 'it', 'its', 'of', 'on', 'that', 'the',
  'to', 'was', 'will', 'with', 'what', 'when', 'where', 'who', 'how'
])

/**
 * Simple stemming: strip common suffixes (ing, ed, s)
 */
function stem(word: string): string {
  if (word.endsWith('ing')) return word.slice(0, -3)
  if (word.endsWith('ed')) return word.slice(0, -2)
  if (word.endsWith('s') && word.length > 2) return word.slice(0, -1)
  return word
}

/**
 * Extract keywords from query: lowercase, split, filter stopwords, stem
 */
export function extractKeywords(query: string): string[] {
  return query
    .toLowerCase()
    .split(/\s+/)
    .map(word => word.replace(/[^a-z0-9]/g, ''))
    .filter(word => word.length > 1 && !STOPWORDS.has(word))
    .map(stem)
}

/**
 * Index notes from vault: walk **\/*.md, skip Wiki/, first 500 chars per file
 */
async function indexNotes(vaultDirs: string[]): Promise<Chunk[]> {
  const chunks: Chunk[] = []

  for (const vaultDir of vaultDirs) {
    try {
      await fs.access(vaultDir)
    } catch {
      continue // Skip non-existent vaults
    }

    // Recursively walk vault directory
    async function walkDir(dir: string) {
      const entries = await fs.readdir(dir, { withFileTypes: true })

      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name)

        // Skip Wiki directory and hidden directories
        if (entry.isDirectory()) {
          if (entry.name === 'Wiki' || entry.name.startsWith('.')) continue
          await walkDir(fullPath)
        } else if (entry.isFile() && entry.name.endsWith('.md')) {
          try {
            const content = await fs.readFile(fullPath, 'utf-8')
            const chunk = content.slice(0, 500)

            // Use filename without extension as title
            const title = entry.name.replace(/\.md$/, '')

            chunks.push({
              id: `note:${fullPath}`,
              source: 'notes',
              title,
              content: chunk,
              metadata: { path: fullPath }
            })
          } catch (err) {
            // Skip files that can't be read
            console.error(`Failed to read note ${fullPath}:`, err)
          }
        }
      }
    }

    try {
      await walkDir(vaultDir)
    } catch (err) {
      console.error(`Failed to walk vault ${vaultDir}:`, err)
    }
  }

  return chunks
}

/**
 * Index projects: use existing scanner logic
 */
async function indexProjects(): Promise<Chunk[]> {
  const projectsDir = process.env.PROJECTS_DIR
  if (!projectsDir) return []

  try {
    const projects = await scanProjects(projectsDir)

    return projects.map(project => {
      const content = [
        project.summary || '',
        project.nextSteps || ''
      ].filter(s => s).join(' ').slice(0, 500)

      return {
        id: `project:${project.path}`,
        source: 'projects',
        title: project.name,
        content,
        metadata: {
          status: project.status,
          path: project.path
        }
      }
    })
  } catch (err) {
    console.error('Failed to index projects:', err)
    return []
  }
}

/**
 * Index chat exports: use chat-export-parser
 */
async function indexChats(): Promise<Chunk[]> {
  const vaultDir = getPrimaryVaultDir()

  try {
    const conversations = await listConversations(vaultDir)

    return conversations.map(conv => {
      return {
        id: `chat:${conv.uuid}`,
        source: 'chats',
        title: conv.name,
        content: conv.preview.slice(0, 500),
        metadata: {
          messageCount: String(conv.messageCount),
          account: conv.account
        }
      }
    })
  } catch (err) {
    console.error('Failed to index chats:', err)
    return []
  }
}

/**
 * Index wiki: read Wiki/**\/*.md entries
 */
async function indexWiki(): Promise<Chunk[]> {
  const vaultDir = getPrimaryVaultDir()

  try {
    const pages = await listPages(vaultDir)

    return pages.map(page => {
      const content = page.summary || ''

      return {
        id: `wiki:${page.name}`,
        source: 'wiki',
        title: page.title,
        content: content.slice(0, 500),
        metadata: {
          status: page.status,
          sources: String(page.sources.length)
        }
      }
    })
  } catch (err) {
    console.error('Failed to index wiki:', err)
    return []
  }
}

/**
 * Index reading list: use reading-log-parser
 */
async function indexReading(): Promise<Chunk[]> {
  const vaultDir = getPrimaryVaultDir()

  try {
    const items = await parseReadingLog(vaultDir)

    return items.map((item, idx) => {
      const content = `${item.title} ${item.url}`

      return {
        id: `reading:${idx}`,
        source: 'reading',
        title: item.title,
        content: content.slice(0, 500),
        metadata: {
          url: item.url,
          read: String(item.read)
        }
      }
    })
  } catch (err) {
    console.error('Failed to index reading:', err)
    return []
  }
}

/**
 * Build full index from all data sources
 */
export async function buildIndex(): Promise<Chunk[]> {
  const vaultDirs = await getVaultDirs()

  const [notes, projects, chats, wiki, reading] = await Promise.all([
    indexNotes(vaultDirs),
    indexProjects(),
    indexChats(),
    indexWiki(),
    indexReading()
  ])

  return [...notes, ...projects, ...chats, ...wiki, ...reading]
}

/**
 * Score a chunk against keywords: count matches in (title * 3 + content)
 */
function scoreChunk(chunk: Chunk, keywords: string[]): number {
  const titleLower = chunk.title.toLowerCase()
  const contentLower = chunk.content.toLowerCase()

  let score = 0

  for (const keyword of keywords) {
    // Title matches count 3x
    const titleMatches = (titleLower.match(new RegExp(keyword, 'g')) || []).length
    score += titleMatches * 3

    // Content matches count 1x
    const contentMatches = (contentLower.match(new RegExp(keyword, 'g')) || []).length
    score += contentMatches
  }

  return score
}

/**
 * Score all chunks and return top-N by score (minimum score > 0)
 */
export function scoreChunks(query: string, chunks: Chunk[], topN: number = 20): Chunk[] {
  const keywords = extractKeywords(query)

  if (keywords.length === 0) {
    return [] // No keywords to match
  }

  const scored: ScoredChunk[] = chunks
    .map(chunk => ({
      chunk,
      score: scoreChunk(chunk, keywords)
    }))
    .filter(s => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, topN)

  return scored.map(s => s.chunk)
}

/**
 * Assemble context string from top chunks, capped at maxChars
 * Format:
 * [source: notes | title: "Note Title"]
 * content...
 *
 * [source: wiki | title: "Wiki Entry"]
 * content...
 */
export function assembleContext(chunks: Chunk[], maxChars: number = 6000): string {
  const parts: string[] = []
  let totalChars = 0

  for (const chunk of chunks) {
    const header = `[source: ${chunk.source} | title: "${chunk.title}"]`
    const section = `${header}\n${chunk.content}\n`

    if (totalChars + section.length > maxChars) {
      // Truncate this chunk to fit
      const remainingChars = maxChars - totalChars
      if (remainingChars > header.length + 50) {
        // Include at least part of the content
        const truncatedContent = chunk.content.slice(0, remainingChars - header.length - 20)
        parts.push(`${header}\n${truncatedContent}...\n`)
      }
      break
    }

    parts.push(section)
    totalChars += section.length
  }

  return parts.join('\n')
}

/**
 * Get unique sources from chunks
 */
export function getUniqueSources(chunks: Chunk[]): string[] {
  const sources = new Set(chunks.map(c => c.source))
  return Array.from(sources)
}

/**
 * Smart search: tries semantic search first, falls back to keyword search
 * Returns chunks sorted by relevance
 */
export async function smartSearch(query: string, topN: number = 20): Promise<Chunk[]> {
  // Try importing semantic search (dynamic import to avoid circular dependency)
  try {
    const { searchSemantic, getIndexStatus } = await import('./embedding-index.js')

    // Check if embeddings are available
    const status = getIndexStatus()
    if (status.totalChunks > 0) {
      const results = await searchSemantic(query, topN)

      if (results.length > 0) {
        // Convert semantic results to chunks
        return results.map((result, idx) => ({
          id: `semantic:${idx}`,
          source: 'notes', // Default source, actual source determined from path
          title: result.filePath.split(/[\\/]/).pop()?.replace(/\.md$/, '') || 'Unknown',
          content: result.content,
          metadata: {
            path: result.filePath,
            score: String(result.score)
          }
        }))
      }
    }
  } catch (err) {
    // Semantic search not available or failed, fall back to keyword
    console.log('[rag] Semantic search unavailable, using keyword search')
  }

  // Fallback to keyword search
  const index = await buildIndex()
  return scoreChunks(query, index, topN)
}
