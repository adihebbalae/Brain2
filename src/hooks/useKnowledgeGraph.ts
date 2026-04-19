import { useState, useEffect } from 'react'

export interface GraphNode {
  id: string
  label: string
  folder: string
  linkCount: number
  filePath: string
}

export interface GraphEdge {
  source: string
  target: string
}

export interface GraphData {
  nodes: GraphNode[]
  edges: GraphEdge[]
  totalNotes: number
}

export function useKnowledgeGraph(limit: number = 200) {
  const [data, setData] = useState<GraphData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let mounted = true

    async function fetchGraph() {
      try {
        setLoading(true)
        setError(null)

        const response = await fetch(`http://localhost:3001/api/knowledge-graph?limit=${limit}`)

        if (!response.ok) {
          throw new Error(`Failed to fetch graph: ${response.statusText}`)
        }

        const result = await response.json()

        if (mounted) {
          setData(result)
        }
      } catch (err) {
        if (mounted) {
          setError(err instanceof Error ? err.message : 'Failed to fetch graph')
        }
      } finally {
        if (mounted) {
          setLoading(false)
        }
      }
    }

    fetchGraph()

    return () => {
      mounted = false
    }
  }, [limit])

  return { data, loading, error }
}
