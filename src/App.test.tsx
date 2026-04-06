import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import App from './App'

// Mock the fetch function
global.fetch = vi.fn()

describe('App', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  const mockAllApis = (projects: any[] = [], todos: any = { total: 0, completed: 0, byProject: {} }, deadlines: any[] = []) => {
    ;(global.fetch as any).mockImplementation((url: string) => {
      if (url.includes('/api/projects')) {
        return Promise.resolve({ ok: true, json: async () => projects })
      }
      if (url.includes('/api/todos')) {
        return Promise.resolve({ ok: true, json: async () => todos })
      }
      if (url.includes('/api/deadlines')) {
        return Promise.resolve({ ok: true, json: async () => deadlines })
      }
      return Promise.reject(new Error('Unknown URL'))
    })
  }

  it('renders the Cortex title', () => {
    mockAllApis()
    render(<App />)
    expect(screen.getByText('Cortex')).toBeTruthy()
  })

  it('shows loading state initially', () => {
    ;(global.fetch as any).mockImplementation(
      () => new Promise(() => {}) // Never resolves
    )

    render(<App />)
    const pulsingElements = document.querySelectorAll('.animate-pulse')
    expect(pulsingElements.length).toBeGreaterThan(0)
  })

  it('renders StatusOverview when projects are loaded', async () => {
    const mockProjects = [
      {
        name: 'Test Project',
        path: '/test/path',
        status: 'active',
        lastModified: new Date().toISOString(),
        staleDays: 0,
        summary: 'Test summary',
        nextSteps: ['Step 1'],
        todos: 5,
        openTodos: 5,
        hasDeadlines: false,
      },
    ]

    mockAllApis(mockProjects)
    render(<App />)

    await waitFor(() => {
      expect(screen.getByText('1 Active')).toBeTruthy()
    })
  })

  it('shows error state on fetch failure', async () => {
    ;(global.fetch as any).mockImplementation((url: string) => {
      if (url.includes('/api/projects')) {
        return Promise.reject(new Error('Network error'))
      }
      // Mock other APIs as successful
      if (url.includes('/api/todos')) {
        return Promise.resolve({ ok: true, json: async () => ({ total: 0, completed: 0, byProject: {} }) })
      }
      if (url.includes('/api/deadlines')) {
        return Promise.resolve({ ok: true, json: async () => [] })
      }
      return Promise.reject(new Error('Unknown URL'))
    })

    render(<App />)

    await waitFor(() => {
      expect(screen.getByText('Error loading projects')).toBeTruthy()
    })
  })

  it('shows empty state when no projects found', async () => {
    mockAllApis([], { total: 0, completed: 0, byProject: {} }, [])
    render(<App />)

    await waitFor(() => {
      expect(screen.getByText('No projects found')).toBeTruthy()
    })
  })
})
