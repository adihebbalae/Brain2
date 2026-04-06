import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { useTodos } from './useTodos'

// Mock fetch
global.fetch = vi.fn()

describe('useTodos', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('should fetch todos on mount', async () => {
    const mockTodos = [
      {
        id: '1',
        text: 'Test todo',
        done: false,
        file: 'test.md',
        line: 1,
        project: 'test-project',
        type: 'checkbox' as const
      }
    ]

    ;(global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => mockTodos
    })

    const { result } = renderHook(() => useTodos())

    expect(result.current.loading).toBe(true)
    expect(result.current.todos).toEqual([])

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    expect(result.current.todos).toEqual(mockTodos)
    expect(result.current.error).toBeNull()
  })

  it('should handle fetch error', async () => {
    ;(global.fetch as any).mockRejectedValueOnce(new Error('Network error'))

    const { result } = renderHook(() => useTodos())

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    expect(result.current.error).toBe('Network error')
    expect(result.current.todos).toEqual([])
  })

  it('should handle HTTP error response', async () => {
    ;(global.fetch as any).mockResolvedValueOnce({
      ok: false,
      statusText: 'Internal Server Error'
    })

    const { result } = renderHook(() => useTodos())

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    expect(result.current.error).toContain('Failed to fetch todos')
  })

  it('should toggle todo optimistically', async () => {
    const mockTodos = [
      {
        id: '1',
        text: 'Test todo',
        done: false,
        file: 'test.md',
        line: 1,
        project: 'test-project',
        type: 'checkbox' as const
      }
    ]

    // Initial fetch
    ;(global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => mockTodos
    })

    const { result } = renderHook(() => useTodos())

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    // Mock successful toggle
    ;(global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true })
    })

    // Toggle the todo
    result.current.toggle('1')

    // Should update immediately (optimistic)
    await waitFor(() => {
      expect(result.current.todos[0].done).toBe(true)
    })

    // Verify PATCH was called
    expect(global.fetch).toHaveBeenCalledWith(
      '/api/todos/1',
      expect.objectContaining({
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ done: true })
      })
    )
  })

  it('should rollback on toggle failure', async () => {
    const mockTodos = [
      {
        id: '1',
        text: 'Test todo',
        done: false,
        file: 'test.md',
        line: 1,
        project: 'test-project',
        type: 'checkbox' as const
      }
    ]

    // Initial fetch
    ;(global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => mockTodos
    })

    const { result } = renderHook(() => useTodos())

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    const eventListener = vi.fn()
    window.addEventListener('todo-error', eventListener)

    // Mock failed toggle
    ;(global.fetch as any).mockRejectedValueOnce(new Error('Network error'))

    // Toggle the todo
    result.current.toggle('1')

    // Wait for rollback
    await waitFor(() => {
      expect(eventListener).toHaveBeenCalled()
    })

    // Should be reverted
    expect(result.current.todos[0].done).toBe(false)

    window.removeEventListener('todo-error', eventListener)
  })

  it('should handle toggle with unsuccessful response', async () => {
    const mockTodos = [
      {
        id: '1',
        text: 'Test todo',
        done: false,
        file: 'test.md',
        line: 1,
        project: 'test-project',
        type: 'checkbox' as const
      }
    ]

    // Initial fetch
    ;(global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => mockTodos
    })

    const { result } = renderHook(() => useTodos())

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    const eventListener = vi.fn()
    window.addEventListener('todo-error', eventListener)

    // Mock unsuccessful toggle
    ;(global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: false, error: 'File not found' })
    })

    // Toggle the todo
    result.current.toggle('1')

    // Wait for rollback
    await waitFor(() => {
      expect(eventListener).toHaveBeenCalled()
    })

    // Should be reverted
    expect(result.current.todos[0].done).toBe(false)

    window.removeEventListener('todo-error', eventListener)
  })

  it('should refetch todos', async () => {
    const mockTodos1 = [
      {
        id: '1',
        text: 'Test todo',
        done: false,
        file: 'test.md',
        line: 1,
        project: 'test-project',
        type: 'checkbox' as const
      }
    ]

    const mockTodos2 = [
      {
        id: '2',
        text: 'New todo',
        done: false,
        file: 'test2.md',
        line: 1,
        project: 'test-project',
        type: 'TODO' as const
      }
    ]

    // Initial fetch
    ;(global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => mockTodos1
    })

    const { result } = renderHook(() => useTodos())

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    expect(result.current.todos).toEqual(mockTodos1)

    // Mock refetch
    ;(global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => mockTodos2
    })

    result.current.refetch()

    await waitFor(() => {
      expect(result.current.todos).toEqual(mockTodos2)
    })
  })

  it('should not toggle if todo not found', async () => {
    const mockTodos = [
      {
        id: '1',
        text: 'Test todo',
        done: false,
        file: 'test.md',
        line: 1,
        project: 'test-project',
        type: 'checkbox' as const
      }
    ]

    // Initial fetch
    ;(global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => mockTodos
    })

    const { result } = renderHook(() => useTodos())

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    const fetchCallCount = (global.fetch as any).mock.calls.length

    // Try to toggle non-existent todo
    result.current.toggle('non-existent')

    // Should not make any new fetch calls
    expect((global.fetch as any).mock.calls.length).toBe(fetchCallCount)
  })
})
