import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor, fireEvent, act } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { FocusMode } from './FocusMode'

// Mock the useTodos hook
vi.mock('../hooks/useTodos', () => ({
  useTodos: () => ({
    todos: [
      {
        id: '1',
        text: 'First task',
        done: false,
        file: 'src/main.ts',
        line: 10,
        project: 'TestProject',
        type: 'checkbox' as const,
      },
      {
        id: '2',
        text: 'Second task',
        done: true,
        file: 'src/app.ts',
        line: 20,
        project: 'TestProject',
        type: 'TODO' as const,
      },
      {
        id: '3',
        text: 'Different project task',
        done: false,
        file: 'src/index.ts',
        line: 5,
        project: 'OtherProject',
        type: 'checkbox' as const,
      },
    ],
    loading: false,
    error: null,
    toggle: vi.fn(),
    refetch: vi.fn(),
  }),
}))

describe('FocusMode', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.useRealTimers()
  })

  it('renders with project name from slug parameter', () => {
    render(
      <MemoryRouter initialEntries={['/focus/TestProject']}>
        <Routes>
          <Route path="/focus/:slug" element={<FocusMode />} />
        </Routes>
      </MemoryRouter>
    )

    expect(screen.getByText('TestProject')).toBeTruthy()
  })

  it('displays timer starting at 25:00', () => {
    render(
      <MemoryRouter initialEntries={['/focus/TestProject']}>
        <Routes>
          <Route path="/focus/:slug" element={<FocusMode />} />
        </Routes>
      </MemoryRouter>
    )

    expect(screen.getByText('25:00')).toBeTruthy()
    expect(screen.getByText('Focus Time')).toBeTruthy()
  })

  it('filters todos by project slug', () => {
    render(
      <MemoryRouter initialEntries={['/focus/TestProject']}>
        <Routes>
          <Route path="/focus/:slug" element={<FocusMode />} />
        </Routes>
      </MemoryRouter>
    )

    // Should show tasks from TestProject
    expect(screen.getByText('First task')).toBeTruthy()
    expect(screen.getByText('Second task')).toBeTruthy()

    // Should NOT show tasks from OtherProject
    expect(screen.queryByText('Different project task')).not.toBeTruthy()
  })

  it('shows task counts correctly', () => {
    render(
      <MemoryRouter initialEntries={['/focus/TestProject']}>
        <Routes>
          <Route path="/focus/:slug" element={<FocusMode />} />
        </Routes>
      </MemoryRouter>
    )

    // 1 remaining (done: false), 1 completed (done: true)
    expect(screen.getByText(/Tasks \(1 remaining\)/i)).toBeTruthy()
  })

  it('shows Start and Reset buttons initially', () => {
    render(
      <MemoryRouter initialEntries={['/focus/TestProject']}>
        <Routes>
          <Route path="/focus/:slug" element={<FocusMode />} />
        </Routes>
      </MemoryRouter>
    )

    expect(screen.getByRole('button', { name: /start/i })).toBeTruthy()
    expect(screen.getByRole('button', { name: /reset/i })).toBeTruthy()
  })

  it('shows Pause button when Start is clicked', () => {
    render(
      <MemoryRouter initialEntries={['/focus/TestProject']}>
        <Routes>
          <Route path="/focus/:slug" element={<FocusMode />} />
        </Routes>
      </MemoryRouter>
    )

    const startButton = screen.getByRole('button', { name: /start/i })
    fireEvent.click(startButton)

    // Should show Pause button after starting
    expect(screen.getByRole('button', { name: /pause/i })).toBeTruthy()
  })

  it('shows Start button when Pause is clicked', () => {
    render(
      <MemoryRouter initialEntries={['/focus/TestProject']}>
        <Routes>
          <Route path="/focus/:slug" element={<FocusMode />} />
        </Routes>
      </MemoryRouter>
    )

    // Start the timer
    const startButton = screen.getByRole('button', { name: /start/i })
    fireEvent.click(startButton)

    // Pause the timer
    const pauseButton = screen.getByRole('button', { name: /pause/i })
    fireEvent.click(pauseButton)

    // Should show Start button again after pausing
    expect(screen.getByRole('button', { name: /start/i })).toBeTruthy()
  })

  it('has functional Reset button', () => {
    render(
      <MemoryRouter initialEntries={['/focus/TestProject']}>
        <Routes>
          <Route path="/focus/:slug" element={<FocusMode />} />
        </Routes>
      </MemoryRouter>
    )

    // Start the timer
    const startButton = screen.getByRole('button', { name: /start/i })
    fireEvent.click(startButton)

    // Reset button should be clickable
    const resetButton = screen.getByRole('button', { name: /reset/i })
    fireEvent.click(resetButton)

    // Should show Start button (idle state)
    expect(screen.getByRole('button', { name: /start/i })).toBeTruthy()
  })

  it('displays cycle indicator dots', () => {
    render(
      <MemoryRouter initialEntries={['/focus/TestProject']}>
        <Routes>
          <Route path="/focus/:slug" element={<FocusMode />} />
        </Routes>
      </MemoryRouter>
    )

    // Should have 6 dots for the pomodoro cycle
    const cycleDots = screen.getByText('25:00').parentElement?.parentElement?.querySelectorAll('[title]')
    expect(cycleDots?.length).toBe(6)
  })

  it('shows exit focus button', () => {
    render(
      <MemoryRouter initialEntries={['/focus/TestProject']}>
        <Routes>
          <Route path="/focus/:slug" element={<FocusMode />} />
        </Routes>
      </MemoryRouter>
    )

    expect(screen.getByRole('button', { name: /exit focus/i })).toBeTruthy()
  })

  it('shows empty state when no todos for project', () => {
    render(
      <MemoryRouter initialEntries={['/focus/EmptyProject']}>
        <Routes>
          <Route path="/focus/:slug" element={<FocusMode />} />
        </Routes>
      </MemoryRouter>
    )

    expect(screen.getByText('No tasks found for this project')).toBeTruthy()
  })

  it('separates completed and incomplete todos', () => {
    render(
      <MemoryRouter initialEntries={['/focus/TestProject']}>
        <Routes>
          <Route path="/focus/:slug" element={<FocusMode />} />
        </Routes>
      </MemoryRouter>
    )

    expect(screen.getByText(/Completed \(1\)/i)).toBeTruthy()
  })
})
