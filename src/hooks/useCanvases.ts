import { useState, useEffect, useCallback } from 'react'

export interface CanvasData {
  filename: string
  filePath: string
  nodeCount: number
  edgeCount: number
  textPreview: string[]
  fileNodes: string[]
  lastModified: string
}

interface UseCanvasesResult {
  canvases: CanvasData[]
  loading: boolean
  error: string | null
  refetch: () => Promise<void>
  addNode: (filename: string, text: string, color?: string) => Promise<boolean>
}

export function useCanvases(): UseCanvasesResult {
  const [canvases, setCanvases] = useState<CanvasData[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchCanvases = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const response = await fetch('http://localhost:3001/api/canvases')
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`)
      }
      const data = await response.json()
      setCanvases(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch canvases')
    } finally {
      setLoading(false)
    }
  }, [])

  const addNode = useCallback(async (filename: string, text: string, color?: string): Promise<boolean> => {
    try {
      const response = await fetch(`http://localhost:3001/api/canvases/${encodeURIComponent(filename)}/add-node`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, color }),
      })

      if (!response.ok) {
        return false
      }

      // Refetch canvases after adding node
      await fetchCanvases()
      return true
    } catch (err) {
      console.error('Failed to add node to canvas:', err)
      return false
    }
  }, [fetchCanvases])

  useEffect(() => {
    fetchCanvases()
    // Poll every 60 seconds
    const interval = setInterval(fetchCanvases, 60000)
    return () => clearInterval(interval)
  }, [fetchCanvases])

  return {
    canvases,
    loading,
    error,
    refetch: fetchCanvases,
    addNode,
  }
}
