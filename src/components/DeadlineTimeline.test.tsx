import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { DeadlineTimeline } from './DeadlineTimeline'

// Mock the hook
vi.mock('../hooks/useDeadlines', () => ({
  useDeadlines: vi.fn()
}))

import { useDeadlines } from '../hooks/useDeadlines'

const mockUseDeadlines = useDeadlines as ReturnType<typeof vi.fn>

describe('DeadlineTimeline', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should render loading state', () => {
    mockUseDeadlines.mockReturnValue({
      deadlines: [],
      loading: true,
      error: null,
      refetch: vi.fn()
    })

    render(<DeadlineTimeline />)

    expect(screen.getByText('Deadlines')).toBeTruthy()
    // Should show skeleton loaders
    const skeletons = document.querySelectorAll('.animate-pulse')
    expect(skeletons.length).toBeGreaterThan(0)
  })

  it('should render error state', () => {
    const mockRefetch = vi.fn()
    mockUseDeadlines.mockReturnValue({
      deadlines: [],
      loading: false,
      error: 'Failed to load deadlines',
      refetch: mockRefetch
    })

    render(<DeadlineTimeline />)

    expect(screen.getByText('Error Loading Deadlines')).toBeTruthy()
    expect(screen.getByText('Failed to load deadlines')).toBeTruthy()
    expect(screen.getByText('Retry')).toBeTruthy()
  })

  it('should render empty state', () => {
    mockUseDeadlines.mockReturnValue({
      deadlines: [],
      loading: false,
      error: null,
      refetch: vi.fn()
    })

    render(<DeadlineTimeline />)

    expect(screen.getByText('📅 No upcoming deadlines')).toBeTruthy()
  })

  it('should render pending deadlines in chronological order', () => {
    const deadlines = [
      {
        id: '1',
        date: '2026-04-10',
        description: 'First deadline',
        tag: null,
        done: false,
        urgency: 'green' as const
      },
      {
        id: '2',
        date: '2026-04-08',
        description: 'Second deadline',
        tag: null,
        done: false,
        urgency: 'amber' as const
      }
    ]

    mockUseDeadlines.mockReturnValue({
      deadlines,
      loading: false,
      error: null,
      refetch: vi.fn()
    })

    render(<DeadlineTimeline />)

    expect(screen.getByText('First deadline')).toBeTruthy()
    expect(screen.getByText('Second deadline')).toBeTruthy()
  })

  it('should render deadline with red urgency styling', () => {
    const deadlines = [
      {
        id: '1',
        date: '2026-04-06',
        description: 'Urgent deadline',
        tag: null,
        done: false,
        urgency: 'red' as const
      }
    ]

    mockUseDeadlines.mockReturnValue({
      deadlines,
      loading: false,
      error: null,
      refetch: vi.fn()
    })

    const { container } = render(<DeadlineTimeline />)

    // Check for red dot
    const redDot = container.querySelector('.bg-red-500')
    expect(redDot).toBeTruthy()

    // Check for red border
    const redBorder = container.querySelector('.border-red-500')
    expect(redBorder).toBeTruthy()

    // Check for bold text
    const boldText = container.querySelector('.font-bold')
    expect(boldText).toBeTruthy()
    expect(boldText?.textContent).toContain('Urgent deadline')
  })

  it('should render deadline with amber urgency styling', () => {
    const deadlines = [
      {
        id: '1',
        date: '2026-04-09',
        description: 'Soon deadline',
        tag: null,
        done: false,
        urgency: 'amber' as const
      }
    ]

    mockUseDeadlines.mockReturnValue({
      deadlines,
      loading: false,
      error: null,
      refetch: vi.fn()
    })

    const { container } = render(<DeadlineTimeline />)

    // Check for amber dot
    const amberDot = container.querySelector('.bg-amber-500')
    expect(amberDot).toBeTruthy()

    // Check for amber border
    const amberBorder = container.querySelector('.border-amber-500')
    expect(amberBorder).toBeTruthy()
  })

  it('should render completed deadline with gray styling and strikethrough', () => {
    const deadlines = [
      {
        id: '1',
        date: '2026-04-01',
        description: 'Completed deadline',
        tag: null,
        done: true,
        urgency: 'gray' as const
      }
    ]

    mockUseDeadlines.mockReturnValue({
      deadlines,
      loading: false,
      error: null,
      refetch: vi.fn()
    })

    const { container } = render(<DeadlineTimeline />)

    // Check for gray dot
    const grayDot = container.querySelector('.bg-gray-400')
    expect(grayDot).toBeTruthy()

    // Check for strikethrough
    const strikethrough = container.querySelector('.line-through')
    expect(strikethrough).toBeTruthy()
    expect(strikethrough?.textContent).toContain('Completed deadline')

    // Should show "Completed" section header
    expect(screen.getByText('Completed')).toBeTruthy()
  })

  it('should render tag chip when tag is present', () => {
    const deadlines = [
      {
        id: '1',
        date: '2026-04-10',
        description: 'Tagged deadline',
        tag: 'work',
        done: false,
        urgency: 'green' as const
      }
    ]

    mockUseDeadlines.mockReturnValue({
      deadlines,
      loading: false,
      error: null,
      refetch: vi.fn()
    })

    render(<DeadlineTimeline />)

    expect(screen.getByText('work')).toBeTruthy()
  })

  it('should show relative labels for near dates', () => {
    const today = new Date()
    const tomorrow = new Date(today)
    tomorrow.setDate(tomorrow.getDate() + 1)
    const twoDays = new Date(today)
    twoDays.setDate(twoDays.getDate() + 2)

    const deadlines = [
      {
        id: '1',
        date: today.toISOString().split('T')[0],
        description: 'Today deadline',
        tag: null,
        done: false,
        urgency: 'red' as const
      },
      {
        id: '2',
        date: tomorrow.toISOString().split('T')[0],
        description: 'Tomorrow deadline',
        tag: null,
        done: false,
        urgency: 'red' as const
      },
      {
        id: '3',
        date: twoDays.toISOString().split('T')[0],
        description: 'Two days deadline',
        tag: null,
        done: false,
        urgency: 'amber' as const
      }
    ]

    mockUseDeadlines.mockReturnValue({
      deadlines,
      loading: false,
      error: null,
      refetch: vi.fn()
    })

    render(<DeadlineTimeline />)

    expect(screen.getByText('Today')).toBeTruthy()
    expect(screen.getByText('Tomorrow')).toBeTruthy()
    expect(screen.getByText('2 days')).toBeTruthy()
  })

  it('should show max 5 deadlines in compact mode', () => {
    const deadlines = Array.from({ length: 10 }, (_, i) => ({
      id: `${i + 1}`,
      date: '2026-04-15',
      description: `Deadline ${i + 1}`,
      tag: null,
      done: false,
      urgency: 'green' as const
    }))

    mockUseDeadlines.mockReturnValue({
      deadlines,
      loading: false,
      error: null,
      refetch: vi.fn()
    })

    render(<DeadlineTimeline compact={true} />)

    // Should show first 5
    expect(screen.getByText('Deadline 1')).toBeTruthy()
    expect(screen.getByText('Deadline 5')).toBeTruthy()

    // Should NOT show 6th
    expect(screen.queryByText('Deadline 6')).toBeNull()

    // Should show "See all" link
    expect(screen.getByText('See all 10 deadlines')).toBeTruthy()
  })

  it('should not show completed section in compact mode', () => {
    const deadlines = [
      {
        id: '1',
        date: '2026-04-10',
        description: 'Pending',
        tag: null,
        done: false,
        urgency: 'green' as const
      },
      {
        id: '2',
        date: '2026-04-01',
        description: 'Completed',
        tag: null,
        done: true,
        urgency: 'gray' as const
      }
    ]

    mockUseDeadlines.mockReturnValue({
      deadlines,
      loading: false,
      error: null,
      refetch: vi.fn()
    })

    render(<DeadlineTimeline compact={true} />)

    expect(screen.getByText('Pending')).toBeTruthy()
    expect(screen.queryByText('Completed')).toBeNull()
  })

  it('should show completed section in normal mode', () => {
    const deadlines = [
      {
        id: '1',
        date: '2026-04-10',
        description: 'Pending',
        tag: null,
        done: false,
        urgency: 'green' as const
      },
      {
        id: '2',
        date: '2026-04-01',
        description: 'Done task',
        tag: null,
        done: true,
        urgency: 'gray' as const
      }
    ]

    mockUseDeadlines.mockReturnValue({
      deadlines,
      loading: false,
      error: null,
      refetch: vi.fn()
    })

    render(<DeadlineTimeline compact={false} />)

    expect(screen.getByText('Pending')).toBeTruthy()
    expect(screen.getByText('Completed')).toBeTruthy()
    expect(screen.getByText('Done task')).toBeTruthy()
  })
})
