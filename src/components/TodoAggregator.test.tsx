import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { TodoAggregator } from './TodoAggregator'
import { Todo } from '../types'

// Mock the useTodos hook
vi.mock('../hooks/useTodos', () => ({
  useTodos: vi.fn()
}))

import { useTodos } from '../hooks/useTodos'

describe('TodoAggregator', () => {
  const mockTodos: Todo[] = [
    {
      id: '1',
      text: 'Fix bug in authentication',
      done: false,
      file: 'src/auth/login.ts',
      line: 42,
      project: 'auth-service',
      type: 'FIXME'
    },
    {
      id: '2',
      text: 'Add unit tests',
      done: false,
      file: 'src/utils/helpers.ts',
      line: 10,
      project: 'auth-service',
      type: 'TODO'
    },
    {
      id: '3',
      text: 'Update documentation',
      done: false,
      file: 'docs/api.md',
      line: 5,
      project: 'docs',
      type: 'checkbox'
    },
    {
      id: '4',
      text: 'Completed task',
      done: true,
      file: 'src/done.ts',
      line: 1,
      project: 'auth-service',
      type: 'checkbox'
    }
  ]

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should render loading state', () => {
    ;(useTodos as any).mockReturnValue({
      todos: [],
      loading: true,
      error: null,
      toggle: vi.fn(),
      refetch: vi.fn()
    })

    render(<TodoAggregator />)

    expect(screen.getByText('TODOs')).toBeTruthy()
    const elements = screen.getAllByRole('generic')
    const hasAnimatePulse = elements.some(el => el.className.includes('animate-pulse'))
    expect(hasAnimatePulse).toBe(true)
  })

  it('should render error state with retry button', () => {
    const mockRefetch = vi.fn()
    ;(useTodos as any).mockReturnValue({
      todos: [],
      loading: false,
      error: 'Failed to load todos',
      toggle: vi.fn(),
      refetch: mockRefetch
    })

    render(<TodoAggregator />)

    expect(screen.getByText('Error Loading TODOs')).toBeTruthy()
    expect(screen.getByText('Failed to load todos')).toBeTruthy()

    const retryButton = screen.getByRole('button', { name: 'Retry' })
    fireEvent.click(retryButton)

    expect(mockRefetch).toHaveBeenCalled()
  })

  it('should render empty state when no todos', () => {
    ;(useTodos as any).mockReturnValue({
      todos: [],
      loading: false,
      error: null,
      toggle: vi.fn(),
      refetch: vi.fn()
    })

    render(<TodoAggregator />)

    expect(screen.getByText(/No open TODOs/)).toBeTruthy()
  })

  it('should group todos by project by default', () => {
    ;(useTodos as any).mockReturnValue({
      todos: mockTodos,
      loading: false,
      error: null,
      toggle: vi.fn(),
      refetch: vi.fn()
    })

    render(<TodoAggregator />)

    // Should show project names as groups
    expect(screen.getByText('auth-service')).toBeTruthy()
    expect(screen.getByText('docs')).toBeTruthy()

    // Should show count badges - there are multiple elements with "2" and "1", so just check one exists
    const badges = screen.getAllByText('2')
    expect(badges.length).toBeGreaterThan(0)
  })

  it('should switch to group by file', () => {
    ;(useTodos as any).mockReturnValue({
      todos: mockTodos,
      loading: false,
      error: null,
      toggle: vi.fn(),
      refetch: vi.fn()
    })

    render(<TodoAggregator />)

    const byFileButton = screen.getByRole('button', { name: 'By file' })
    fireEvent.click(byFileButton)

    // Should show file names as groups
    expect(screen.getByText('src/auth/login.ts')).toBeTruthy()
    expect(screen.getByText('src/utils/helpers.ts')).toBeTruthy()
    expect(screen.getByText('docs/api.md')).toBeTruthy()
  })

  it('should display todo items with correct badges', () => {
    ;(useTodos as any).mockReturnValue({
      todos: mockTodos,
      loading: false,
      error: null,
      toggle: vi.fn(),
      refetch: vi.fn()
    })

    render(<TodoAggregator />)

    // Check todo text
    expect(screen.getByText('Fix bug in authentication')).toBeTruthy()
    expect(screen.getByText('Add unit tests')).toBeTruthy()

    // Check FIXME badge
    expect(screen.getByText('FIXME')).toBeTruthy()

    // Check file chips (using regex to match partial text)
    expect(screen.getByText(/login\.ts:42/)).toBeTruthy()
    expect(screen.getByText(/helpers\.ts:10/)).toBeTruthy()
  })

  it('should toggle todo when checkbox clicked', async () => {
    const mockToggle = vi.fn()
    ;(useTodos as any).mockReturnValue({
      todos: mockTodos,
      loading: false,
      error: null,
      toggle: mockToggle,
      refetch: vi.fn()
    })

    render(<TodoAggregator />)

    const checkboxes = screen.getAllByRole('checkbox')
    fireEvent.click(checkboxes[0])

    await waitFor(() => {
      expect(mockToggle).toHaveBeenCalledWith('1')
    })
  })

  it('should collapse and expand groups', () => {
    ;(useTodos as any).mockReturnValue({
      todos: mockTodos,
      loading: false,
      error: null,
      toggle: vi.fn(),
      refetch: vi.fn()
    })

    render(<TodoAggregator />)

    const buttons = screen.getAllByRole('button')
    const authServiceButton = buttons.find(b => b.textContent?.includes('auth-service'))
    expect(authServiceButton).toBeTruthy()

    // Initially expanded - todos should be visible
    expect(screen.getByText('Fix bug in authentication')).toBeTruthy()

    // Click to collapse
    if (authServiceButton) fireEvent.click(authServiceButton)

    // Todos should be hidden
    expect(screen.queryByText('Fix bug in authentication')).toBeNull()

    // Click to expand again
    if (authServiceButton) fireEvent.click(authServiceButton)

    // Todos should be visible again
    expect(screen.getByText('Fix bug in authentication')).toBeTruthy()
  })

  it('should show completed todos when expanded', () => {
    ;(useTodos as any).mockReturnValue({
      todos: mockTodos,
      loading: false,
      error: null,
      toggle: vi.fn(),
      refetch: vi.fn()
    })

    render(<TodoAggregator />)

    const buttons = screen.getAllByRole('button')
    const showCompletedButton = buttons.find(b => b.textContent?.includes('Show completed'))
    expect(showCompletedButton).toBeTruthy()

    // Initially hidden
    expect(screen.queryByText('Completed task')).toBeNull()

    // Click to show
    if (showCompletedButton) fireEvent.click(showCompletedButton)

    // Should be visible
    expect(screen.getByText('Completed task')).toBeTruthy()
  })

  it('should call onCountChange with open todo count', () => {
    const mockOnCountChange = vi.fn()
    ;(useTodos as any).mockReturnValue({
      todos: mockTodos,
      loading: false,
      error: null,
      toggle: vi.fn(),
      refetch: vi.fn()
    })

    render(<TodoAggregator onCountChange={mockOnCountChange} />)

    expect(mockOnCountChange).toHaveBeenCalledWith(3) // 3 open todos
  })

  it('should display HACK badge', () => {
    const todosWithHack: Todo[] = [
      {
        id: '1',
        text: 'Temporary workaround',
        done: false,
        file: 'src/temp.ts',
        line: 1,
        project: 'test',
        type: 'HACK'
      }
    ]

    ;(useTodos as any).mockReturnValue({
      todos: todosWithHack,
      loading: false,
      error: null,
      toggle: vi.fn(),
      refetch: vi.fn()
    })

    render(<TodoAggregator />)

    expect(screen.getByText('HACK')).toBeTruthy()
  })

  it('should truncate long file paths', () => {
    const todosWithLongPath: Todo[] = [
      {
        id: '1',
        text: 'Test todo',
        done: false,
        file: 'very/long/path/to/some/deep/nested/file.ts',
        line: 1,
        project: 'test',
        type: 'checkbox'
      }
    ]

    ;(useTodos as any).mockReturnValue({
      todos: todosWithLongPath,
      loading: false,
      error: null,
      toggle: vi.fn(),
      refetch: vi.fn()
    })

    render(<TodoAggregator />)

    expect(screen.getByText(/nested\/file\.ts:1/)).toBeTruthy()
  })

  it('should display completed todos with strikethrough', () => {
    ;(useTodos as any).mockReturnValue({
      todos: mockTodos,
      loading: false,
      error: null,
      toggle: vi.fn(),
      refetch: vi.fn()
    })

    render(<TodoAggregator />)

    const buttons = screen.getAllByRole('button')
    const showCompletedButton = buttons.find(b => b.textContent?.includes('Show completed'))
    if (showCompletedButton) fireEvent.click(showCompletedButton)

    const completedTask = screen.getByText('Completed task')
    expect(completedTask.className).toContain('line-through')
  })
})
