import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { Project } from '../types'

interface ProjectDetailViewProps {
  project: Project
  onClose: () => void
}

const NOTES_KEY = (path: string) => `cortex-project-notes:${path}`

function getStatusBadgeClasses(status: Project['status']): string {
  switch (status) {
    case 'active': return 'bg-green-100 text-green-800'
    case 'stale': return 'bg-amber-100 text-amber-800'
    case 'archived': return 'bg-gray-100 text-gray-600'
    default: return 'bg-gray-100 text-gray-600'
  }
}

function getStaleBadge(staleDays: number): { label: string; className: string } | null {
  if (staleDays > 30) return { label: `${staleDays}d stale`, className: 'bg-red-100 text-red-700' }
  if (staleDays > 14) return { label: `${staleDays}d stale`, className: 'bg-amber-100 text-amber-700' }
  return null
}

export function ProjectDetailView({ project, onClose }: ProjectDetailViewProps) {
  const navigate = useNavigate()
  const [notes, setNotes] = useState('')
  const [notesSaved, setNotesSaved] = useState(false)
  const [captureText, setCaptureText] = useState('')
  const [captureSent, setCaptureSent] = useState(false)
  const panelRef = useRef<HTMLDivElement>(null)
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Load notes from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem(NOTES_KEY(project.path))
    if (saved) setNotes(saved)
  }, [project.path])

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [onClose])

  // Click-outside to close
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) onClose()
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [onClose])

  function handleNotesChange(val: string) {
    setNotes(val)
    setNotesSaved(false)
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => {
      localStorage.setItem(NOTES_KEY(project.path), val)
      setNotesSaved(true)
    }, 800)
  }

  async function handleSendToInbox() {
    if (!captureText.trim()) return
    try {
      await fetch('/api/capture', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: `[${project.name}] ${captureText.trim()}` }),
      })
      setCaptureText('')
      setCaptureSent(true)
      setTimeout(() => setCaptureSent(false), 2000)
    } catch {
      // silently fail — capture is best-effort
    }
  }

  const staleBadge = getStaleBadge(project.staleDays)

  return (
    <div className="fixed inset-0 z-50 flex items-stretch bg-black/40">
      {/* Backdrop (click to close) handled by useEffect above */}
      <div className="ml-auto flex">
        <div
          ref={panelRef}
          className="w-[600px] max-w-full h-screen bg-white shadow-2xl flex flex-col overflow-hidden"
        >
          {/* Header */}
          <div className="flex items-start justify-between p-6 border-b border-gray-200 bg-gray-50">
            <div className="flex-1 min-w-0 pr-4">
              <h2 className="text-xl font-bold text-gray-900 truncate">{project.name}</h2>
              <div className="flex items-center gap-2 mt-2 flex-wrap">
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusBadgeClasses(project.status)}`}>
                  {project.status}
                </span>
                {staleBadge && (
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${staleBadge.className}`}>
                    {staleBadge.label}
                  </span>
                )}
                <span className="text-xs text-gray-500">
                  Last modified {new Date(project.lastModified).toLocaleDateString()}
                </span>
              </div>
            </div>
            <button
              onClick={onClose}
              className="shrink-0 p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-200 transition-colors"
              aria-label="Close"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Scrollable body */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6">

            {/* Summary */}
            <section>
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Summary</h3>
              <p className="text-gray-700 text-sm leading-relaxed">
                {project.summary || 'No summary available.'}
              </p>
            </section>

            {/* Current state */}
            <section>
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Current State</h3>
              <p className="text-gray-700 text-sm leading-relaxed">
                {project.currentState || 'No current state available.'}
              </p>
            </section>

            {/* Next Steps */}
            {project.nextSteps.length > 0 && (
              <section>
                <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Next Steps</h3>
                <ul className="space-y-1.5">
                  {project.nextSteps.map((step, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
                      <span className="mt-0.5 shrink-0 w-5 h-5 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-xs font-bold">{i + 1}</span>
                      <span>{step}</span>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {/* Notes (local, editable) */}
            <section>
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">My Notes</h3>
                {notesSaved && (
                  <span className="text-xs text-green-600 flex items-center gap-1">
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    Saved
                  </span>
                )}
              </div>
              <textarea
                value={notes}
                onChange={e => handleNotesChange(e.target.value)}
                placeholder="Add your notes, ideas, or reminders for this project..."
                className="w-full h-28 px-3 py-2 text-sm text-gray-700 border border-gray-200 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <p className="text-xs text-gray-400 mt-1">Saved locally in your browser.</p>
            </section>

            {/* Send to Inbox */}
            <section>
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Add to Inbox</h3>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={captureText}
                  onChange={e => setCaptureText(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') handleSendToInbox() }}
                  placeholder={`Quick capture for ${project.name}...`}
                  className="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <button
                  onClick={handleSendToInbox}
                  disabled={!captureText.trim()}
                  className="px-3 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-40 transition-colors"
                >
                  {captureSent ? '✓' : 'Add'}
                </button>
              </div>
            </section>
          </div>

          {/* Footer */}
          <div className="p-4 border-t border-gray-200 bg-gray-50 flex items-center justify-between">
            <span className="text-xs text-gray-400 font-mono truncate max-w-xs">{project.path}</span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => navigate(`/focus/${encodeURIComponent(project.name)}`)}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-blue-700 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Focus
              </button>
              <a
                href={project.vscodeUrl}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
                Open in VS Code
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
