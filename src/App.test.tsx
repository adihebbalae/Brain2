import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import App from './App'
import { resetProjectsStoreForTests } from './hooks/useProjects'

// Mock the fetch function
global.fetch = vi.fn()

describe('App', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    resetProjectsStoreForTests()
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
      // Return empty/default responses for other endpoints to avoid breaking tests
      if (url.includes('/api/git-activity')) {
        return Promise.resolve({ ok: true, json: async () => ({ projects: [], heatmap: [], totalCommits: 0 }) })
      }
      if (url.includes('/api/chats')) {
        return Promise.resolve({ ok: true, json: async () => [] })
      }
      if (url.includes('/api/wiki')) {
        return Promise.resolve({ ok: true, json: async () => ({ pages: [] }) })
      }
      if (url.includes('/api/calendar')) {
        return Promise.resolve({ ok: true, json: async () => ({ events: [], authUrl: null }) })
      }
      if (url.includes('/api/youtube-history')) {
        return Promise.resolve({ ok: true, json: async () => ({ videos: [], stats: {} }) })
      }
      if (url.includes('/api/reading')) {
        return Promise.resolve({ ok: true, json: async () => ({ items: [] }) })
      }
      if (url.includes('/api/canvases')) {
        return Promise.resolve({ ok: true, json: async () => [] })
      }
      if (url.includes('/api/review')) {
        return Promise.resolve({ ok: true, json: async () => ({ queue: [] }) })
      }
      if (url.includes('/api/daily-context')) {
        return Promise.resolve({ ok: true, json: async () => ({
          date: new Date().toISOString(),
          deadlines: [],
          staleProjects: [],
          calendarEvents: [],
          randomNotes: [],
          gitActivity: { projects: [], heatmap: [], totalCommits: 0 }
        }) })
      }
      if (url.includes('/api/config')) {
        return Promise.resolve({ ok: true, json: async () => ({ vaultName: 'SecondBrain', projectsDir: 'C:\\Projects' }) })
      }
      // Return empty success for any other unknown endpoint
      return Promise.resolve({ ok: true, json: async () => ({}) })
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
      // Return empty/default responses for other endpoints
      if (url.includes('/api/git-activity')) {
        return Promise.resolve({ ok: true, json: async () => ({ projects: [], heatmap: [], totalCommits: 0 }) })
      }
      if (url.includes('/api/daily-context')) {
        return Promise.resolve({ ok: true, json: async () => ({
          date: new Date().toISOString(),
          deadlines: [],
          staleProjects: [],
          calendarEvents: [],
          randomNotes: [],
          gitActivity: { projects: [], heatmap: [], totalCommits: 0 }
        }) })
      }
      if (url.includes('/api/config')) {
        return Promise.resolve({ ok: true, json: async () => ({ vaultName: 'SecondBrain', projectsDir: 'C:\\Projects' }) })
      }
      // Return empty success for any other unknown endpoint
      return Promise.resolve({ ok: true, json: async () => ({}) })
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
