import { useState, useEffect, useRef } from 'react'

export interface ContextSwitchModalProps {
  previousProject: { slug: string; name: string }
  onSubmit: (data: { doing: string; blocking: string; next: string }) => void
  onSkip: () => void
}

const SKIP_PREF_KEY = 'cortex-skip-context-switch'

export function ContextSwitchModal({ previousProject, onSubmit, onSkip }: ContextSwitchModalProps) {
  const [doing, setDoing] = useState('')
  const [blocking, setBlocking] = useState('')
  const [next, setNext] = useState('')
  const [alwaysSkip, setAlwaysSkip] = useState(false)
  const doingRef = useRef<HTMLTextAreaElement>(null)

  // Auto-focus first textarea
  useEffect(() => {
    doingRef.current?.focus()
  }, [])

  function handleSubmit() {
    if (!doing.trim() || !blocking.trim() || !next.trim()) return
    onSubmit({ doing: doing.trim(), blocking: blocking.trim(), next: next.trim() })
  }

  function handleSkip() {
    if (alwaysSkip) {
      localStorage.setItem(SKIP_PREF_KEY, 'true')
    }
    onSkip()
  }

  // Handle Escape key
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') handleSkip()
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [alwaysSkip]) // eslint-disable-line react-hooks/exhaustive-deps

  const canSubmit = doing.trim() && blocking.trim() && next.trim()

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-[600px] mx-4 bg-white rounded-xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-indigo-600 to-purple-600 px-6 py-5">
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <span>🧠</span>
            <span>Brain Dump — Leaving {previousProject.name}</span>
          </h2>
          <p className="text-indigo-100 text-sm mt-1">
            Clear your mind before switching. Break the attention residue.
          </p>
        </div>

        {/* Form */}
        <div className="p-6 space-y-5">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              What were you just doing?
            </label>
            <textarea
              ref={doingRef}
              value={doing}
              onChange={e => setDoing(e.target.value)}
              placeholder="Describe what you were working on..."
              rows={3}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              What's blocking you?
            </label>
            <textarea
              value={blocking}
              onChange={e => setBlocking(e.target.value)}
              placeholder="What obstacles or unknowns stopped you? (or write 'nothing' if unblocked)"
              rows={3}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              What's the very next step?
            </label>
            <textarea
              value={next}
              onChange={e => setNext(e.target.value)}
              placeholder="The single next action when you return to this project..."
              rows={3}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="bg-gray-50 px-6 py-4 border-t border-gray-200">
          <div className="flex items-center justify-between">
            <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
              <input
                type="checkbox"
                checked={alwaysSkip}
                onChange={e => setAlwaysSkip(e.target.checked)}
                className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
              />
              <span>Always skip brain dumps</span>
            </label>
            <div className="flex items-center gap-2">
              <button
                onClick={handleSkip}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Skip
              </button>
              <button
                onClick={handleSubmit}
                disabled={!canSubmit}
                className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
              >
                Save &amp; Switch
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
