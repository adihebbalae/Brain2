import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { useDeadlines } from './useDeadlines'

// Mock fetch globally
global.fetch = vi.fn()

describe('useDeadlines', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should fetch deadlines on mount', async () => {
    const mockDeadlines = [
      {
        id: '1',
        date: '2026-04-10',
        description: 'Test deadline',
        tag: 'work',
        done: false,
        urgency: 'green' as const
      }
    ]

    ;(global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: async () => mockDeadlines
    })

    const { result } = renderHook(() => useDeadlines())

    expect(result.current.loading).toBe(true)
    expect(result.current.deadlines).toEqual([])

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    expect(result.current.deadlines).toEqual(mockDeadlines)
    expect(result.current.error).toBeNull()
    expect(global.fetch).toHaveBeenCalledWith('/api/deadlines')
  })

  it('should handle fetch error', async () => {
    ;(global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: false,
      statusText: 'Internal Server Error'
    })

    const { result } = renderHook(() => useDeadlines())

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    expect(result.current.error).toBe('Failed to fetch deadlines: Internal Server Error')
    expect(result.current.deadlines).toEqual([])
  })

  it('should handle network error', async () => {
    ;(global.fetch as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
      new Error('Network error')
    )

    const { result } = renderHook(() => useDeadlines())

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    expect(result.current.error).toBe('Network error')
    expect(result.current.deadlines).toEqual([])
  })

  it('should refetch deadlines when refetch is called', async () => {
    const mockDeadlines1 = [
      {
        id: '1',
        date: '2026-04-10',
        description: 'First deadline',
        tag: null,
        done: false,
        urgency: 'green' as const
      }
    ]

    const mockDeadlines2 = [
      {
        id: '2',
        date: '2026-04-12',
        description: 'Second deadline',
        tag: 'urgent',
        done: false,
        urgency: 'red' as const
      }
    ]

    ;(global.fetch as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockDeadlines1
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockDeadlines2
      })

    const { result } = renderHook(() => useDeadlines())

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    expect(result.current.deadlines).toEqual(mockDeadlines1)

    // Call refetch
    result.current.refetch()

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    expect(result.current.deadlines).toEqual(mockDeadlines2)
    expect(global.fetch).toHaveBeenCalledTimes(2)
  })

  it('should clear error on successful refetch', async () => {
    ;(global.fetch as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce({
        ok: false,
        statusText: 'Error'
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => []
      })

    const { result } = renderHook(() => useDeadlines())

    await waitFor(() => {
      expect(result.current.error).toBeTruthy()
    })

    // Refetch
    result.current.refetch()

    await waitFor(() => {
      expect(result.current.error).toBeNull()
    })

    expect(result.current.deadlines).toEqual([])
  })
})
