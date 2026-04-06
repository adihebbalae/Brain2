import { useState, useEffect, useRef, FormEvent } from 'react'

export interface QuickCaptureProps {
  onCapture?: () => void
}

interface Toast {
  message: string
  type: 'success' | 'error'
}

export function QuickCapture({ onCapture }: QuickCaptureProps) {
  const [text, setText] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [toast, setToast] = useState<Toast | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Ctrl+K keyboard shortcut to focus input
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key === 'k') {
        e.preventDefault()
        inputRef.current?.focus()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [])

  // Auto-dismiss toast after 2 seconds
  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => {
        setToast(null)
      }, 2000)
      return () => clearTimeout(timer)
    }
  }, [toast])

  const handleSubmit = async (e?: FormEvent) => {
    e?.preventDefault()

    // Sanitize input: trim whitespace, don't submit blank strings
    const sanitizedText = text.trim()
    if (!sanitizedText || isSubmitting) {
      return
    }

    setIsSubmitting(true)

    try {
      const response = await fetch('/api/capture', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ text: sanitizedText })
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to capture')
      }

      // Success: clear input and show success toast
      setText('')
      setToast({ message: 'Captured!', type: 'success' })

      // Call optional callback (parent can use to trigger refetch)
      onCapture?.()
    } catch (err) {
      // Error: keep input unchanged, show error toast
      const errorMessage = err instanceof Error ? err.message : 'Failed to capture'
      setToast({ message: errorMessage, type: 'error' })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <>
      <form onSubmit={handleSubmit} className="flex gap-3 items-center">
        <input
          ref={inputRef}
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          disabled={isSubmitting}
          maxLength={2000}
          placeholder="Capture a thought... (Ctrl+K)"
          className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed"
          data-testid="capture-input"
        />
        <button
          type="submit"
          disabled={!text.trim() || isSubmitting}
          className="px-6 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
          data-testid="capture-button"
        >
          {isSubmitting ? 'Capturing...' : 'Capture'}
        </button>
      </form>

      {/* Toast notification */}
      {toast && (
        <div
          className={`fixed top-4 right-4 px-6 py-3 rounded-lg shadow-lg animate-fade-in ${
            toast.type === 'success'
              ? 'bg-green-500 text-white'
              : 'bg-red-500 text-white'
          }`}
          role="alert"
          data-testid="toast"
        >
          {toast.message}
        </div>
      )}
    </>
  )
}
