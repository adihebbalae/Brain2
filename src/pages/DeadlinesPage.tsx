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

interface EditForm {
  date: string
  description: string
  tag: string
  notes: string
  done: boolean
}

export function DeadlinesPage() {
  const { deadlines, loading, error, refetch, updateDeadline } = useDeadlines()

  // Add form state
  const [date, setDate] = useState(() => new Date().toISOString().split('T')[0])
  const [description, setDescription] = useState('')
  const [tag, setTag] = useState('')
  const [notes, setNotes] = useState('')
  const [adding, setAdding] = useState(false)
  const [addError, setAddError] = useState<string | null>(null)
  const descRef = useRef<HTMLInputElement>(null)

  // Delete state
  const [deletingId, setDeletingId] = useState<string | null>(null)

  // Edit state
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState<EditForm | null>(null)
  const [saving, setSaving] = useState(false)
  const [editError, setEditError] = useState<string | null>(null)

  function startEdit(d: Deadline) {
    setEditingId(d.id)
    setEditForm({
      date: d.date,
      description: d.description,
      tag: d.tag ?? '',
      notes: d.notes ?? '',
      done: d.done,
    })
    setEditError(null)
  }

  function cancelEdit() {
    setEditingId(null)
    setEditForm(null)
    setEditError(null)
  }

  async function handleSaveEdit(e: React.FormEvent) {
    e.preventDefault()
    if (!editingId || !editForm) return
    setSaving(true)
    setEditError(null)
    try {
      await updateDeadline(editingId, {
        date: editForm.date,
        description: editForm.description.trim(),
        tag: editForm.tag.trim() || null,
        notes: editForm.notes.trim() || null,
        done: editForm.done,
      })
      setEditingId(null)
      setEditForm(null)
    } catch (err) {
      setEditError(err instanceof Error ? err.message : 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    if (!description.trim()) return
    setAdding(true)
    setAddError(null)
    try {
      const res = await fetch('/api/deadlines', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date,
          description: description.trim(),
          tag: tag.trim() || null,
          notes: notes.trim() || null,
        }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error ?? 'Failed to add deadline')
      }
      setDescription('')
      setTag('')
      setNotes('')
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

  function renderDeadlineRow(d: Deadline, isCompleted = false) {
    if (editingId === d.id && editForm) {
      return (
        <div key={d.id} className="px-4 py-3 rounded-xl border border-blue-300 bg-blue-50">
          <form onSubmit={handleSaveEdit} className="space-y-3">
            <div className="flex flex-wrap gap-2">
              <input
                type="date"
                value={editForm.date}
                onChange={e => setEditForm(f => f && ({ ...f, date: e.target.value }))}
                required
                className="px-2 py-1 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-gray-900"
              />
              <input
                type="text"
                value={editForm.description}
                onChange={e => setEditForm(f => f && ({ ...f, description: e.target.value }))}
                placeholder="Description"
                required
                className="flex-1 min-w-40 px-2 py-1 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-gray-900"
              />
              <input
                type="text"
                value={editForm.tag}
                onChange={e => setEditForm(f => f && ({ ...f, tag: e.target.value }))}
                placeholder="Tag (optional)"
                className="w-28 px-2 py-1 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-gray-900"
              />
              <label className="flex items-center gap-1.5 text-sm text-gray-700 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={editForm.done}
                  onChange={e => setEditForm(f => f && ({ ...f, done: e.target.checked }))}
                  className="w-4 h-4 rounded accent-blue-600"
                />
                Done
              </label>
            </div>
            <textarea
              value={editForm.notes}
              onChange={e => setEditForm(f => f && ({ ...f, notes: e.target.value }))}
              placeholder="Notes (optional) — extra context, links, reminders…"
              rows={2}
              className="w-full px-2 py-1 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-gray-900 resize-none"
            />
            {editError && <p className="text-xs text-red-600">{editError}</p>}
            <div className="flex gap-2">
              <button
                type="submit"
                disabled={saving || !editForm.description.trim()}
                className="px-3 py-1 bg-blue-600 text-white text-xs font-medium rounded-lg hover:bg-blue-700 disabled:opacity-40 transition-colors"
              >
                {saving ? 'Saving…' : 'Save'}
              </button>
              <button
                type="button"
                onClick={cancelEdit}
                className="px-3 py-1 bg-white text-gray-700 text-xs font-medium rounded-lg border border-gray-300 hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )
    }

    if (isCompleted) {
      return (
        <div
          key={d.id}
          className="flex items-start gap-4 px-4 py-3 rounded-xl border bg-gray-50 border-gray-200 text-gray-400"
        >
          <span className="shrink-0 w-2.5 h-2.5 rounded-full bg-gray-300 mt-1.5" />
          <div className="flex-1 min-w-0">
            <p className="text-sm line-through">{d.description}</p>
            <span className="text-xs opacity-70">{d.date}</span>
            {d.notes && <p className="text-xs mt-1 opacity-60">{d.notes}</p>}
          </div>
          <button
            onClick={() => startEdit(d)}
            className="shrink-0 p-1.5 rounded-lg hover:bg-gray-200 opacity-40 hover:opacity-70 transition-opacity"
            aria-label="Edit deadline"
            title="Edit"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
          </button>
          <button
            onClick={() => handleDelete(d.id)}
            disabled={deletingId === d.id}
            className="shrink-0 p-1.5 rounded-lg hover:bg-gray-200 opacity-40 hover:opacity-70 transition-opacity disabled:opacity-30"
            aria-label="Remove deadline"
            title="Remove"
          >
            {deletingId === d.id ? <span className="text-xs">…</span> : (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            )}
          </button>
        </div>
      )
    }

    return (
      <div
        key={d.id}
        className={`flex items-start gap-4 px-4 py-3 rounded-xl border ${getUrgencyClasses(d.urgency)}`}
      >
        <span className={`shrink-0 w-2.5 h-2.5 rounded-full ${getDotClass(d.urgency)} mt-1.5`} />
        <div className="flex-1 min-w-0">
          <p className="font-medium text-sm leading-tight">{d.description}</p>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-xs opacity-70">{d.date}</span>
            {d.tag && (
              <span className="text-xs px-1.5 py-0.5 rounded-full bg-white/60 font-medium">{d.tag}</span>
            )}
          </div>
          {d.notes && (
            <p className="text-xs mt-1.5 opacity-75 leading-snug">{d.notes}</p>
          )}
        </div>
        <span className="shrink-0 text-xs font-medium mt-0.5">{formatDaysUntil(d.daysUntil, d.done)}</span>
        <button
          onClick={() => startEdit(d)}
          className="shrink-0 p-1.5 rounded-lg hover:bg-white/50 text-current opacity-50 hover:opacity-100 transition-opacity"
          aria-label="Edit deadline"
          title="Edit"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
          </svg>
        </button>
        <button
          onClick={() => handleDelete(d.id)}
          disabled={deletingId === d.id}
          className="shrink-0 p-1.5 rounded-lg hover:bg-white/50 text-current opacity-50 hover:opacity-100 transition-opacity disabled:opacity-30"
          aria-label="Remove deadline"
          title="Remove"
        >
          {deletingId === d.id ? <span className="text-xs">…</span> : (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          )}
        </button>
      </div>
    )
  }

  return (
    <div className="max-w-3xl mx-auto px-6 py-8 space-y-8">

      {/* Add deadline form */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Add Deadline</h2>
        <form onSubmit={handleAdd} className="space-y-3">
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
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Notes (optional)</label>
            <input
              type="text"
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Extra context, links, reminders…"
              className="px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
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
                {pending.map(d => renderDeadlineRow(d))}
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
                {completed.slice(0, 10).map(d => renderDeadlineRow(d, true))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
