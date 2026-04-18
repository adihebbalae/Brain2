import { useState, useEffect, useCallback } from 'react'

export type ReviewStatus = 'never_reviewed' | 'overdue_90d' | 'overdue_60d' | 'overdue_30d' | 'current'

export interface ReviewQueueItem {
  relativePath: string
  title: string
  preview: string
  lastReviewed: string | null
  status: ReviewStatus
  daysSince: number | null
}

interface ReviewQueueResponse {
  queue: ReviewQueueItem[]
  totalDue: number
  neverReviewed: number
}

interface UseReviewQueueReturn {
  queue: ReviewQueueItem[]
  totalDue: number
  neverReviewed: number
  loading: boolean
  error: string | null
  refetch: () => void
  markReviewed: (filePath: string) => Promise<void>
  getRandomNote: () => Promise<ReviewQueueItem | null>
}

export function useReviewQueue(): UseReviewQueueReturn {
  const [queue, setQueue] = useState<ReviewQueueItem[]>([])
  const [totalDue, setTotalDue] = useState(0)
  const [neverReviewed, setNeverReviewed] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchQueue = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const response = await fetch('/api/review/queue')

      if (!response.ok) {
        throw new Error(`Failed to fetch review queue: ${response.statusText}`)
      }

      const data: ReviewQueueResponse = await response.json()
      setQueue(data.queue)
      setTotalDue(data.totalDue)
      setNeverReviewed(data.neverReviewed)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load review queue')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchQueue()
    // Poll every 60 seconds
    const intervalId = setInterval(fetchQueue, 60_000)
    return () => clearInterval(intervalId)
  }, [fetchQueue])

  const markReviewed = useCallback(async (filePath: string) => {
    try {
      const response = await fetch('/api/review/log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filePath })
      })

      if (!response.ok) {
        throw new Error(`Failed to mark as reviewed: ${response.statusText}`)
      }

      // Refetch queue after marking
      await fetchQueue()
    } catch (err) {
      console.error('Failed to mark note as reviewed:', err)
      throw err
    }
  }, [fetchQueue])

  const getRandomNote = useCallback(async (): Promise<ReviewQueueItem | null> => {
    try {
      const response = await fetch('/api/review/queue/random')

      if (!response.ok) {
        throw new Error(`Failed to fetch random note: ${response.statusText}`)
      }

      const data = await response.json()
      return data.note || null
    } catch (err) {
      console.error('Failed to fetch random note:', err)
      return null
    }
  }, [])

  return {
    queue,
    totalDue,
    neverReviewed,
    loading,
    error,
    refetch: fetchQueue,
    markReviewed,
    getRandomNote
  }
}
