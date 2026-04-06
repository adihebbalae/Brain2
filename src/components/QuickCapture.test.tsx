import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { QuickCapture } from './QuickCapture'

describe('QuickCapture', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Mock fetch
    global.fetch = vi.fn()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('should render input and button', () => {
    render(<QuickCapture />)

    const input = screen.getByTestId('capture-input')
    const button = screen.getByTestId('capture-button')

    expect(input).toBeTruthy()
    expect(button).toBeTruthy()
    expect((input as HTMLInputElement).placeholder).toBe('Capture a thought... (Ctrl+K)')
  })

  it('should disable button when input is empty', () => {
    render(<QuickCapture />)

    const button = screen.getByTestId('capture-button') as HTMLButtonElement

    expect(button.disabled).toBe(true)
  })

  it('should enable button when input has text', () => {
    render(<QuickCapture />)

    const input = screen.getByTestId('capture-input') as HTMLInputElement
    const button = screen.getByTestId('capture-button') as HTMLButtonElement

    fireEvent.change(input, { target: { value: 'Test thought' } })

    expect(button.disabled).toBe(false)
  })

  it('should disable button for whitespace-only input', () => {
    render(<QuickCapture />)

    const input = screen.getByTestId('capture-input') as HTMLInputElement
    const button = screen.getByTestId('capture-button') as HTMLButtonElement

    fireEvent.change(input, { target: { value: '   ' } })

    expect(button.disabled).toBe(true)
  })

  it('should submit on button click', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, entry: '- [ ] [2026-04-05 14:32] Test thought' })
    })
    global.fetch = mockFetch

    render(<QuickCapture />)

    const input = screen.getByTestId('capture-input') as HTMLInputElement
    const button = screen.getByTestId('capture-button')

    fireEvent.change(input, { target: { value: 'Test thought' } })
    fireEvent.click(button)

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith('/api/capture', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ text: 'Test thought' })
      })
    })
  })

  it('should submit on Enter key press', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, entry: '- [ ] [2026-04-05 14:32] Test thought' })
    })
    global.fetch = mockFetch

    render(<QuickCapture />)

    const input = screen.getByTestId('capture-input') as HTMLInputElement

    fireEvent.change(input, { target: { value: 'Test thought' } })
    fireEvent.submit(input.closest('form')!)

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith('/api/capture', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ text: 'Test thought' })
      })
    })
  })

  it('should clear input on success', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, entry: '- [ ] [2026-04-05 14:32] Test thought' })
    })
    global.fetch = mockFetch

    render(<QuickCapture />)

    const input = screen.getByTestId('capture-input') as HTMLInputElement

    fireEvent.change(input, { target: { value: 'Test thought' } })
    fireEvent.submit(input.closest('form')!)

    await waitFor(() => {
      expect(input.value).toBe('')
    })
  })

  it('should show success toast on successful capture', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, entry: '- [ ] [2026-04-05 14:32] Test thought' })
    })
    global.fetch = mockFetch

    render(<QuickCapture />)

    const input = screen.getByTestId('capture-input') as HTMLInputElement

    fireEvent.change(input, { target: { value: 'Test thought' } })
    fireEvent.submit(input.closest('form')!)

    await waitFor(() => {
      const toast = screen.getByTestId('toast')
      expect(toast).toBeTruthy()
      expect(toast.textContent).toBe('Captured!')
      expect(toast.className).toContain('bg-green-500')
    })
  })

  it('should show error toast on failure', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      json: async () => ({ error: 'Server error' })
    })
    global.fetch = mockFetch

    render(<QuickCapture />)

    const input = screen.getByTestId('capture-input') as HTMLInputElement

    fireEvent.change(input, { target: { value: 'Test thought' } })
    fireEvent.submit(input.closest('form')!)

    await waitFor(() => {
      const toast = screen.getByTestId('toast')
      expect(toast).toBeTruthy()
      expect(toast.textContent).toBe('Server error')
      expect(toast.className).toContain('bg-red-500')
    })
  })

  it('should keep input unchanged on error', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      json: async () => ({ error: 'Server error' })
    })
    global.fetch = mockFetch

    render(<QuickCapture />)

    const input = screen.getByTestId('capture-input') as HTMLInputElement

    fireEvent.change(input, { target: { value: 'Test thought' } })
    fireEvent.submit(input.closest('form')!)

    await waitFor(() => {
      expect(input.value).toBe('Test thought')
    })
  })

  it('should trim whitespace before submitting', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, entry: '- [ ] [2026-04-05 14:32] Test thought' })
    })
    global.fetch = mockFetch

    render(<QuickCapture />)

    const input = screen.getByTestId('capture-input') as HTMLInputElement

    fireEvent.change(input, { target: { value: '  Test thought  ' } })
    fireEvent.submit(input.closest('form')!)

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith('/api/capture', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ text: 'Test thought' })
      })
    })
  })

  it('should not submit when input is blank after trimming', async () => {
    const mockFetch = vi.fn()
    global.fetch = mockFetch

    render(<QuickCapture />)

    const input = screen.getByTestId('capture-input') as HTMLInputElement

    fireEvent.change(input, { target: { value: '   ' } })
    fireEvent.submit(input.closest('form')!)

    await waitFor(() => {
      expect(mockFetch).not.toHaveBeenCalled()
    }, { timeout: 500 })
  })

  it('should focus input on Ctrl+K', () => {
    render(<QuickCapture />)

    const input = screen.getByTestId('capture-input') as HTMLInputElement

    // Blur the input first
    input.blur()
    expect(document.activeElement).not.toBe(input)

    // Press Ctrl+K
    fireEvent.keyDown(document, { key: 'k', ctrlKey: true })

    expect(document.activeElement).toBe(input)
  })

  it('should prevent default behavior on Ctrl+K', () => {
    render(<QuickCapture />)

    const event = new KeyboardEvent('keydown', { key: 'k', ctrlKey: true, bubbles: true })
    const preventDefaultSpy = vi.spyOn(event, 'preventDefault')

    document.dispatchEvent(event)

    expect(preventDefaultSpy).toHaveBeenCalled()
  })

  it('should call onCapture callback after successful submission', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, entry: '- [ ] [2026-04-05 14:32] Test thought' })
    })
    global.fetch = mockFetch

    const onCapture = vi.fn()
    render(<QuickCapture onCapture={onCapture} />)

    const input = screen.getByTestId('capture-input') as HTMLInputElement

    fireEvent.change(input, { target: { value: 'Test thought' } })
    fireEvent.submit(input.closest('form')!)

    await waitFor(() => {
      expect(onCapture).toHaveBeenCalledTimes(1)
    })
  })

  it('should not call onCapture callback on error', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      json: async () => ({ error: 'Server error' })
    })
    global.fetch = mockFetch

    const onCapture = vi.fn()
    render(<QuickCapture onCapture={onCapture} />)

    const input = screen.getByTestId('capture-input') as HTMLInputElement

    fireEvent.change(input, { target: { value: 'Test thought' } })
    fireEvent.submit(input.closest('form')!)

    await waitFor(() => {
      expect(onCapture).not.toHaveBeenCalled()
    })
  })

  it('should disable input and button while submitting', async () => {
    const mockFetch = vi.fn().mockImplementation(() =>
      new Promise(resolve =>
        setTimeout(() => resolve({
          ok: true,
          json: async () => ({ success: true, entry: '- [ ] [2026-04-05 14:32] Test thought' })
        }), 100)
      )
    )
    global.fetch = mockFetch

    render(<QuickCapture />)

    const input = screen.getByTestId('capture-input') as HTMLInputElement
    const button = screen.getByTestId('capture-button') as HTMLButtonElement

    fireEvent.change(input, { target: { value: 'Test thought' } })
    fireEvent.submit(input.closest('form')!)

    // Check immediately after submit
    expect(input.disabled).toBe(true)
    expect(button.disabled).toBe(true)
    expect(button.textContent).toBe('Capturing...')

    // Wait for completion
    await waitFor(() => {
      expect(input.disabled).toBe(false)
    })
  })

  it('should enforce maxLength of 2000 characters', () => {
    render(<QuickCapture />)

    const input = screen.getByTestId('capture-input') as HTMLInputElement

    expect(input.maxLength).toBe(2000)
  })

  it('should auto-dismiss toast after 2 seconds', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, entry: '- [ ] [2026-04-05 14:32] Test thought' })
    })
    global.fetch = mockFetch

    render(<QuickCapture />)

    const input = screen.getByTestId('capture-input') as HTMLInputElement

    fireEvent.change(input, { target: { value: 'Test thought' } })
    fireEvent.submit(input.closest('form')!)

    // Wait for toast to appear
    await waitFor(() => {
      expect(screen.getByTestId('toast')).toBeTruthy()
    })

    // Verify toast is present
    expect(screen.getByTestId('toast')).toBeTruthy()

    // Wait for toast to disappear (2 seconds + buffer)
    await waitFor(
      () => {
        expect(screen.queryByTestId('toast')).toBeNull()
      },
      { timeout: 3000 }
    )
  })

  it('should cleanup keyboard event listener on unmount', () => {
    const removeEventListenerSpy = vi.spyOn(document, 'removeEventListener')

    const { unmount } = render(<QuickCapture />)

    unmount()

    expect(removeEventListenerSpy).toHaveBeenCalledWith('keydown', expect.any(Function))
  })
})
