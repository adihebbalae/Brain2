import { useState, useRef } from 'react'
import { useDeadlines } from '../hooks/useDeadlines'
import { Deadline } from '../types'

function getUrgencyClasses(urgency: Deadline['urgency']): string {
  switch (urgency) {
    case 'red': return 'bg-red-50 border-red-300 text-red-800'
    case 'amber': return 'bg-amber-50 border-amber-300 text-amber-800'
    case 'green': return 'bg-green-50 border-green-300 text-green-800'
    case 'gray': return 'bg-gray-50 border-gray-200 text-gray-500'
  }
}

function getDotClass(urgency: Deadline['urgency']): string {
  switch (urgency) {
    case 'red': return 'bg-red-500'
    case 'amber': return 'bg-amber-400'
    case 'green': return 'bg-green-500'
    case 'gray': return 'bg-gray-300'
  }
}

function formatDaysUntil(days: number, done: boolean): string {
  if (done) return 'Done'
  if (days < 0) return `${Math.abs(days)}d overdue`
  if (days === 0) return 'Today'
  if (days === 1) return 'Tomorrow'
  return `In ${days} days`
}

export function DeadlinesPage() {
  const { deadlines, loading, error, refetch } = useDeadlines()

  // Form state
  const [date, setDate] = useState(() => new Date().toISOString().split('T')[0])
  const [description, setDescription] = useState('')
  const [tag, setTag] = useState('')
  const [adding, setAdding] = useState(false)
  const [addError, setAddError] = useState<string | null>(null)
  const descRef = useRef<HTMLInputElement>(null)

  // Deletion state (track which ID is being deleted)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    if (!description.trim()) return
    setAdding(true)
    setAddError(null)
    try {
      const res = await fetch('/api/deadlines', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date, description: description.trim(), tag: tag.trim() || null }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error ?? 'Failed to add deadline')
      }
      setDescription('')
      setTag('')
      refetch()
      descRef.current?.focus()
    } catch (err) {
      setAddError(err instanceof Error ? err.message : 'Failed to add deadline')
    } finally {
      setAdding(false)
    }
  }

  async function handleDelete(id: string) {
    setDeletingId(id)
    try {
      await fetch(`/api/deadlines/${id}`, { method: 'DELETE' })
      refetch()
    } finally {
      setDeletingId(null)
    }
  }

  const pending = deadlines.filter(d => !d.done)
  const completed = deadlines.filter(d => d.done)

  return (
    <div className="max-w-3xl mx-auto px-6 py-8 space-y-8">

      {/* Add deadline form */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Add Deadline</h2>
        <form onSubmit={handleAdd} className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Date</label>
              <input
                type="date"
                value={date}
                onChange={e => setDate(e.target.value)}
                required
                className="px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="flex-1 flex flex-col gap-1">
              <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Description</label>
              <input
                ref={descRef}
                type="text"
                value={description}
                onChange={e => setDescription(e.target.value)}
                placeholder="What's due?"
                required
                className="px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="flex flex-col gap-1 w-28">
              <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Tag</label>
              <input
                type="text"
                value={tag}
                onChange={e => setTag(e.target.value)}
                placeholder="work, school…"
                className="px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
          {addError && <p className="text-sm text-red-600">{addError}</p>}
          <button
            type="submit"
            disabled={adding || !description.trim()}
            className="px-5 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-40 transition-colors"
          >
            {adding ? 'Adding…' : 'Add Deadline'}
          </button>
        </form>
      </div>

      {/* Deadline list */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-16 bg-gray-100 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : error ? (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-red-700 text-sm">{error}</div>
      ) : (
        <div className="space-y-8">
          {/* Pending */}
          <div>
            <h2 className="text-base font-semibold text-gray-800 mb-3">
              Upcoming
              {pending.length > 0 && <span className="ml-2 text-sm font-normal text-gray-500">({pending.length})</span>}
            </h2>
            {pending.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-8">📅 No upcoming deadlines</p>
            ) : (
              <div className="space-y-2">
                {pending.map(d => (
                  <div
                    key={d.id}
                    className={`flex items-center gap-4 px-4 py-3 rounded-xl border ${getUrgencyClasses(d.urgency)}`}
                  >
                    <span className={`shrink-0 w-2.5 h-2.5 rounded-full ${getDotClass(d.urgency)}`} />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm leading-tight">{d.description}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-xs opacity-70">{d.date}</span>
                        {d.tag && (
                          <span className="text-xs px-1.5 py-0.5 rounded-full bg-white/60 font-medium">{d.tag}</span>
                        )}
                      </div>
                    </div>
                    <span className="shrink-0 text-xs font-medium">{formatDaysUntil(d.daysUntil, d.done)}</span>
                    <button
                      onClick={() => handleDelete(d.id)}
                      disabled={deletingId === d.id}
                      className="shrink-0 p-1.5 rounded-lg hover:bg-white/50 text-current opacity-50 hover:opacity-100 transition-opacity disabled:opacity-30"
                      aria-label="Remove deadline"
                      title="Remove"
                    >
                      {deletingId === d.id
                        ? <span className="text-xs">…</span>
                        : (
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        )
                      }
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Completed */}
          {completed.length > 0 && (
            <div>
              <h2 className="text-base font-semibold text-gray-500 mb-3">
                Completed
                <span className="ml-2 text-sm font-normal">({completed.length})</span>
              </h2>
              <div className="space-y-2">
                {completed.slice(0, 10).map(d => (
                  <div
                    key={d.id}
                    className="flex items-center gap-4 px-4 py-3 rounded-xl border bg-gray-50 border-gray-200 text-gray-400"
                  >
                    <span className="shrink-0 w-2.5 h-2.5 rounded-full bg-gray-300" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm line-through">{d.description}</p>
                      <span className="text-xs opacity-70">{d.date}</span>
                    </div>
                    <button
                      onClick={() => handleDelete(d.id)}
                      disabled={deletingId === d.id}
                      className="shrink-0 p-1.5 rounded-lg hover:bg-gray-200 opacity-40 hover:opacity-70 transition-opacity"
                      aria-label="Remove deadline"
                      title="Remove"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
