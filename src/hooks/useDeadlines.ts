import { useState, useEffect, useCallback } from 'react'
import { Deadline } from '../types'

interface UseDeadlinesReturn {
  deadlines: Deadline[]
  loading: boolean
  error: string | null
  refetch: () => void
}

export function useDeadlines(): UseDeadlinesReturn {
  const [deadlines, setDeadlines] = useState<Deadline[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchDeadlines = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const response = await fetch('/api/deadlines')

      if (!response.ok) {
        throw new Error(`Failed to fetch deadlines: ${response.statusText}`)
      }

      const data = await response.json()
      setDeadlines(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load deadlines')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchDeadlines()
    // Poll every 60 seconds
    const intervalId = setInterval(fetchDeadlines, 60_000)
    return () => clearInterval(intervalId)
  }, [fetchDeadlines])

  return {
    deadlines,
    loading,
    error,
    refetch: fetchDeadlines
  }
}
