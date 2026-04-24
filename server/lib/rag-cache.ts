import { buildIndex, type Chunk } from './rag-engine.js'

const INDEX_CACHE_TTL_MS = 5 * 60 * 1000
const REFRESH_CHECK_INTERVAL_MS = 60 * 1000

let cachedIndex: Chunk[] | null = null
let indexTimestamp = 0
let buildRequest: Promise<Chunk[]> | null = null
let refreshTimer: NodeJS.Timeout | null = null

function hasFreshIndex(now = Date.now()): boolean {
  return cachedIndex !== null && (now - indexTimestamp) < INDEX_CACHE_TTL_MS
}

async function rebuildIndex(reason: string): Promise<Chunk[]> {
  if (buildRequest) {
    return buildRequest
  }

  console.log(`[RAG] Building index... (${reason})`)

  buildRequest = buildIndex()
    .then(index => {
      cachedIndex = index
      indexTimestamp = Date.now()
      console.log(`[RAG] Index ready (${index.length} chunks)`)
      return index
    })
    .catch(error => {
      console.error('[RAG] Failed to build index:', error)
      throw error
    })
    .finally(() => {
      buildRequest = null
    })

  return buildRequest
}

export async function getRagIndex(): Promise<Chunk[]> {
  if (hasFreshIndex()) {
    return cachedIndex!
  }

  if (cachedIndex) {
    void rebuildIndex('stale-refresh').catch(() => {})
    return cachedIndex
  }

  return rebuildIndex('cold-start')
}

export function startRagIndexBackgroundRefresh(): void {
  if (refreshTimer) {
    return
  }

  void rebuildIndex('startup').catch(() => {})

  refreshTimer = setInterval(() => {
    if (!cachedIndex || !hasFreshIndex()) {
      void rebuildIndex('background-refresh').catch(() => {})
    }
  }, REFRESH_CHECK_INTERVAL_MS)

  refreshTimer.unref?.()
}

export function resetRagIndexCache(): void {
  cachedIndex = null
  indexTimestamp = 0
  buildRequest = null
  if (refreshTimer) {
    clearInterval(refreshTimer)
    refreshTimer = null
  }
}
