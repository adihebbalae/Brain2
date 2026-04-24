import { useState, useEffect, useCallback } from 'react'
import { Deadline } from '../types'

type DeadlineUpdates = Partial<Pick<Deadline, 'date' | 'description' | 'tag' | 'done'>> & { notes?: string | null }

interface UseDeadlinesReturn {
  deadlines: Deadline[]
  loading: boolean
  error: string | null
  refetch: () => void
  updateDeadline: (id: string, updates: DeadlineUpdates) => Promise<void>
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

  const updateDeadline = useCallback(async (id: string, updates: DeadlineUpdates) => {
    const response = await fetch(`/api/deadlines/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    })
    if (!response.ok) {
      const body = await response.json().catch(() => ({}))
      throw new Error(body.error ?? 'Failed to update deadline')
    }
    await fetchDeadlines()
  }, [fetchDeadlines])

  return {
    deadlines,
    loading,
    error,
    refetch: fetchDeadlines,
    updateDeadline,
  }
}
