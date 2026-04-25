import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ContextSwitchModal } from './ContextSwitchModal'

describe('ContextSwitchModal', () => {
  it('renders with project name', () => {
    const onSubmit = vi.fn()
    const onSkip = vi.fn()

    render(
      <ContextSwitchModal
        previousProject={{ slug: 'test-project', name: 'Test Project' }}
        onSubmit={onSubmit}
        onSkip={onSkip}
      />
    )

    expect(screen.getByText(/Leaving Test Project/)).toBeTruthy()
  })

  it('renders all three text areas', () => {
    const onSubmit = vi.fn()
    const onSkip = vi.fn()

    render(
      <ContextSwitchModal
        previousProject={{ slug: 'test-project', name: 'Test Project' }}
        onSubmit={onSubmit}
        onSkip={onSkip}
      />
    )

    expect(screen.getByPlaceholderText(/what you were working on/i)).toBeTruthy()
    expect(screen.getByPlaceholderText(/obstacles or unknowns/i)).toBeTruthy()
    expect(screen.getByPlaceholderText(/single next action/i)).toBeTruthy()
  })

  it('Save & Switch button is disabled when fields are empty', () => {
    const onSubmit = vi.fn()
    const onSkip = vi.fn()

    render(
      <ContextSwitchModal
        previousProject={{ slug: 'test-project', name: 'Test Project' }}
        onSubmit={onSubmit}
        onSkip={onSkip}
      />
    )

    const submitButton = screen.getByText('Save & Switch')
    expect(submitButton).toHaveProperty('disabled', true)
  })

  it('Save & Switch button is enabled when all fields are filled', () => {
    const onSubmit = vi.fn()
    const onSkip = vi.fn()

    render(
      <ContextSwitchModal
        previousProject={{ slug: 'test-project', name: 'Test Project' }}
        onSubmit={onSubmit}
        onSkip={onSkip}
      />
    )

    const doingInput = screen.getByPlaceholderText(/what you were working on/i)
    const blockingInput = screen.getByPlaceholderText(/obstacles or unknowns/i)
    const nextInput = screen.getByPlaceholderText(/single next action/i)

    fireEvent.change(doingInput, { target: { value: 'Writing tests' } })
    fireEvent.change(blockingInput, { target: { value: 'Nothing' } })
    fireEvent.change(nextInput, { target: { value: 'Deploy to production' } })

    const submitButton = screen.getByText('Save & Switch')
    expect(submitButton).toHaveProperty('disabled', false)
  })

  it('calls onSubmit with trimmed values', () => {
    const onSubmit = vi.fn()
    const onSkip = vi.fn()

    render(
      <ContextSwitchModal
        previousProject={{ slug: 'test-project', name: 'Test Project' }}
        onSubmit={onSubmit}
        onSkip={onSkip}
      />
    )

    const doingInput = screen.getByPlaceholderText(/what you were working on/i)
    const blockingInput = screen.getByPlaceholderText(/obstacles or unknowns/i)
    const nextInput = screen.getByPlaceholderText(/single next action/i)

    fireEvent.change(doingInput, { target: { value: '  Writing tests  ' } })
    fireEvent.change(blockingInput, { target: { value: '  Nothing  ' } })
    fireEvent.change(nextInput, { target: { value: '  Deploy  ' } })

    const submitButton = screen.getByText('Save & Switch')
    fireEvent.click(submitButton)

    expect(onSubmit).toHaveBeenCalledWith({
      doing: 'Writing tests',
      blocking: 'Nothing',
      next: 'Deploy'
    })
  })

  it('calls onSkip when Skip button is clicked', () => {
    const onSubmit = vi.fn()
    const onSkip = vi.fn()

    render(
      <ContextSwitchModal
        previousProject={{ slug: 'test-project', name: 'Test Project' }}
        onSubmit={onSubmit}
        onSkip={onSkip}
      />
    )

    const skipButton = screen.getByText('Skip')
    fireEvent.click(skipButton)

    expect(onSkip).toHaveBeenCalled()
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('saves skip preference to localStorage when checkbox is checked', () => {
    const onSubmit = vi.fn()
    const onSkip = vi.fn()

    // Clear localStorage before test
    localStorage.clear()

    render(
      <ContextSwitchModal
        previousProject={{ slug: 'test-project', name: 'Test Project' }}
        onSubmit={onSubmit}
        onSkip={onSkip}
      />
    )

    const checkbox = screen.getByLabelText(/always skip brain dumps/i)
    fireEvent.click(checkbox)

    const skipButton = screen.getByText('Skip')
    fireEvent.click(skipButton)

    expect(localStorage.getItem('cortex-skip-context-switch')).toBe('true')
  })

  it('does not save skip preference when checkbox is unchecked', () => {
    const onSubmit = vi.fn()
    const onSkip = vi.fn()

    // Clear localStorage before test
    localStorage.clear()

    render(
      <ContextSwitchModal
        previousProject={{ slug: 'test-project', name: 'Test Project' }}
        onSubmit={onSubmit}
        onSkip={onSkip}
      />
    )

    const skipButton = screen.getByText('Skip')
    fireEvent.click(skipButton)

    expect(localStorage.getItem('cortex-skip-context-switch')).toBeNull()
  })
})
