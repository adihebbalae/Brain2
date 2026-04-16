import { useState, useEffect, useCallback } from 'react'

const API_BASE = 'http://localhost:3001'

export interface WikiPage {
  name: string
  title: string
  status: string
  sources: string[]
  lastUpdated: string
  summary: string
}

interface WikiState {
  wikiExists: boolean
  pages: WikiPage[]
  loading: boolean
  error: string | null
}

interface QueryResult {
  answer: string
  citations: string[]
  error?: string
}

interface LintResult {
  orphans: string[]
  stale: string[]
  gaps: string[]
  healthScore: number
  wikiExists?: boolean
}

interface IngestResult {
  pagesCreated: string[]
  pagesUpdated: string[]
  error?: string
}

export function useWiki(): WikiState & {
  query: (question: string) => Promise<QueryResult>
  lint: () => Promise<LintResult>
  ingest: (sourcePath: string) => Promise<IngestResult>
  refetch: () => void
} {
  const [wikiExists, setWikiExists] = useState(false)
  const [pages, setPages] = useState<WikiPage[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchIndex = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const response = await fetch(`${API_BASE}/api/wiki/index`)

      if (!response.ok) {
        throw new Error(`Failed to fetch wiki index: ${response.statusText}`)
      }

      const data = await response.json()
      setWikiExists(data.wikiExists || false)
      setPages(data.pages || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch wiki index')
      console.error('Error fetching wiki index:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchIndex()
  }, [fetchIndex])

  const query = useCallback(async (question: string): Promise<QueryResult> => {
    try {
      const response = await fetch(`${API_BASE}/api/wiki/query`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ question }),
      })

      if (!response.ok) {
        throw new Error(`Failed to query wiki: ${response.statusText}`)
      }

      const data = await response.json()
      return data
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to query wiki'
      return {
        answer: '',
        citations: [],
        error: errorMessage,
      }
    }
  }, [])

  const lint = useCallback(async (): Promise<LintResult> => {
    try {
      const response = await fetch(`${API_BASE}/api/wiki/lint`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      })

      if (!response.ok) {
        throw new Error(`Failed to lint wiki: ${response.statusText}`)
      }

      const data = await response.json()
      return data
    } catch (err) {
      console.error('Error linting wiki:', err)
      throw err
    }
  }, [])

  const ingest = useCallback(async (sourcePath: string): Promise<IngestResult> => {
    try {
      const response = await fetch(`${API_BASE}/api/wiki/ingest`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ sourcePath }),
      })

      if (!response.ok) {
        throw new Error(`Failed to ingest source: ${response.statusText}`)
      }

      const data = await response.json()

      // Refetch index after successful ingest
      if (!data.error) {
        await fetchIndex()
      }

      return data
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to ingest source'
      return {
        pagesCreated: [],
        pagesUpdated: [],
        error: errorMessage,
      }
    }
  }, [fetchIndex])

  return {
    wikiExists,
    pages,
    loading,
    error,
    query,
    lint,
    ingest,
    refetch: fetchIndex,
  }
}
