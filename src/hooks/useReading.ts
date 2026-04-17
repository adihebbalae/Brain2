import { useState, useEffect, useCallback } from 'react'
import type { ReadingResponse } from '../types'

const API_BASE = 'http://localhost:3001/api'
const POLL_INTERVAL = 60000 // 60 seconds

export function useReading(status: 'all' | 'read' | 'unread' = 'all') {
  const [data, setData] = useState<ReadingResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchReading = useCallback(async () => {
    try {
      const response = await fetch(`${API_BASE}/reading?status=${status}`)
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`)
      }
      const result = await response.json()
      setData(result)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch reading items')
    } finally {
      setLoading(false)
    }
  }, [status])

  const addItem = useCallback(async (url: string, title?: string): Promise<boolean> => {
    try {
      const response = await fetch(`${API_BASE}/reading`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url, title }),
      })

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`)
      }

      // Refetch after successful add
      await fetchReading()
      return true
    } catch (err) {
      console.error('Failed to add reading item:', err)
      return false
    }
  }, [fetchReading])

  // Initial fetch
  useEffect(() => {
    fetchReading()
  }, [fetchReading])

  // Polling
  useEffect(() => {
    const interval = setInterval(fetchReading, POLL_INTERVAL)
    return () => clearInterval(interval)
  }, [fetchReading])

  return {
    data,
    loading,
    error,
    refetch: fetchReading,
    addItem,
  }
}
