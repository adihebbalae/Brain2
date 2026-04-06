import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import App from './App'

// Mock the fetch function
global.fetch = vi.fn()

describe('App', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders the Cortex title', () => {
    ;(global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => [],
    })

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

    ;(global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => mockProjects,
    })

    render(<App />)

    await waitFor(() => {
      expect(screen.getByText('1 Active')).toBeTruthy()
    })
  })

  it('shows error state on fetch failure', async () => {
    ;(global.fetch as any).mockRejectedValueOnce(new Error('Network error'))

    render(<App />)

    await waitFor(() => {
      expect(screen.getByText('Error loading projects')).toBeTruthy()
    })
  })

  it('shows empty state when no projects found', async () => {
    ;(global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => [],
    })

    render(<App />)

    await waitFor(() => {
      expect(screen.getByText('No projects found')).toBeTruthy()
    })
  })
})
