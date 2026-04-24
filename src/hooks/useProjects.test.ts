import { describe, it, expect, vi, beforeEach } from 'vitest'
import { act, renderHook, waitFor } from '@testing-library/react'
import { useProjects, resetProjectsStoreForTests } from './useProjects'

global.fetch = vi.fn()

describe('useProjects', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    resetProjectsStoreForTests()
  })

  it('shares the initial projects fetch across multiple hook instances', async () => {
    const mockProjects = [
      {
        name: 'Brain2',
        path: 'Brain2',
        status: 'active',
        lastModified: '2026-04-24T12:00:00.000Z',
        summary: 'Project summary',
        currentState: 'Current state',
        nextSteps: [],
        staleDays: 0,
        vscodeUrl: 'vscode://file/Brain2',
        openTodos: 0,
        todos: 0,
        hasDeadlines: false,
      },
    ]

    ;(global.fetch as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockProjects,
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          results: [
            {
              name: 'Brain2',
              summary: 'AI summary',
              currentState: 'AI current state',
            },
          ],
        }),
      })

    const firstHook = renderHook(() => useProjects())
    const secondHook = renderHook(() => useProjects())

    await waitFor(() => {
      expect(firstHook.result.current.loading).toBe(false)
      expect(secondHook.result.current.loading).toBe(false)
    })

    await waitFor(() => {
      expect(firstHook.result.current.projects[0]?.summary).toBe('AI summary')
      expect(secondHook.result.current.projects[0]?.currentState).toBe('AI current state')
    })

    expect(global.fetch).toHaveBeenCalledTimes(2)
    expect(global.fetch).toHaveBeenNthCalledWith(1, 'http://localhost:3001/api/projects')
    expect(global.fetch).toHaveBeenNthCalledWith(
      2,
      'http://localhost:3001/api/ai/summarize-all',
      expect.objectContaining({
        method: 'POST',
      })
    )

    firstHook.unmount()
    secondHook.unmount()
  })

  it('forces a new projects request when refetch is called', async () => {
    const initialProjects = [
      {
        name: 'Brain2',
        path: 'Brain2',
        status: 'active',
        lastModified: '2026-04-24T12:00:00.000Z',
        summary: 'Initial summary',
        currentState: 'Initial state',
        nextSteps: [],
        staleDays: 0,
        vscodeUrl: 'vscode://file/Brain2',
        openTodos: 0,
        todos: 0,
        hasDeadlines: false,
      },
    ]

    const refreshedProjects = [
      {
        ...initialProjects[0],
        summary: 'Refreshed summary',
        currentState: 'Refreshed state',
        lastModified: '2026-04-24T13:00:00.000Z',
      },
    ]

    ;(global.fetch as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => initialProjects,
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ results: [] }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => refreshedProjects,
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ results: [] }),
      })

    const { result } = renderHook(() => useProjects())

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    expect(result.current.projects[0]?.summary).toBe('Initial summary')

    act(() => {
      result.current.refetch()
    })

    await waitFor(() => {
      expect(result.current.projects[0]?.summary).toBe('Refreshed summary')
    })

    expect(global.fetch).toHaveBeenCalledTimes(4)
  })
})
