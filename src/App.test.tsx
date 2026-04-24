import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
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
        vscodeUrl: 'vscode://file/test/path',
      },
    ]

    mockAllApis(mockProjects)
    render(<App />)

    // The home page should show the StatusOverview
    await waitFor(() => {
      expect(screen.getByText(/1 Active/i)).toBeTruthy()
    }, { timeout: 3000 })
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

    // Navigate to Projects page where project errors are shown
    await waitFor(() => {
      const projectsLink = screen.getByText('Projects')
      expect(projectsLink).toBeTruthy()
    })

    fireEvent.click(screen.getByText('Projects'))

    await waitFor(() => {
      expect(screen.getByText(/Error loading projects/i)).toBeTruthy()
    }, { timeout: 3000 })
  })

  it('shows empty state when no projects found', async () => {
    mockAllApis()
    render(<App />)

    // Navigate to Projects page where empty state is shown
    await waitFor(() => {
      const projectsLink = screen.getByText('Projects')
      expect(projectsLink).toBeTruthy()
    })

    fireEvent.click(screen.getByText('Projects'))

    await waitFor(() => {
      expect(screen.getByText(/No projects match your filter/i)).toBeTruthy()
    }, { timeout: 3000 })
  })
})
