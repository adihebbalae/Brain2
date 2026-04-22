import { useState } from 'react'
import { useReviewQueue, ReviewQueueItem } from '../hooks/useReviewQueue'
import { useConfig } from '../hooks/useConfig'

export function ReviewPanel() {
  const { vaultName } = useConfig()
  const { queue, totalDue, neverReviewed, loading, error, refetch, markReviewed, getRandomNote } = useReviewQueue()
  const [currentIndex, setCurrentIndex] = useState(0)
  const [surpriseNote, setSurpriseNote] = useState<ReviewQueueItem | null>(null)
  const [showSurpriseModal, setShowSurpriseModal] = useState(false)
  const [markingReviewed, setMarkingReviewed] = useState(false)

  // Get current note from queue
  const currentNote = queue[currentIndex]

  // Calculate progress: % of notes reviewed in last 30 days
  const totalNotes = queue.length + (totalDue > 0 ? Math.floor(totalDue * 1.5) : 10) // Estimate total
  const reviewedRecently = Math.max(0, totalNotes - totalDue)
  const progressPercent = totalNotes > 0 ? Math.round((reviewedRecently / totalNotes) * 100) : 0

  const handleMarkReviewed = async () => {
    if (!currentNote) return

    setMarkingReviewed(true)
    try {
      await markReviewed(currentNote.relativePath)
      // Move to next note after successful mark
      setCurrentIndex(0) // Reset to first (queue will be updated)
    } catch (err) {
      console.error('Failed to mark as reviewed:', err)
    } finally {
      setMarkingReviewed(false)
    }
  }

  const handleSkip = () => {
    // Move to next item in queue (cycle back to 0 if at end)
    setCurrentIndex((currentIndex + 1) % queue.length)
  }

  const handleSurpriseMe = async () => {
    const note = await getRandomNote()
    if (note) {
      setSurpriseNote(note)
      setShowSurpriseModal(true)
    }
  }

  const handleMarkSurpriseReviewed = async () => {
    if (!surpriseNote) return

    setMarkingReviewed(true)
    try {
      await markReviewed(surpriseNote.relativePath)
      setShowSurpriseModal(false)
      setSurpriseNote(null)
    } catch (err) {
      console.error('Failed to mark surprise note as reviewed:', err)
    } finally {
      setMarkingReviewed(false)
    }
  }

  const getStatusBadge = (status: ReviewQueueItem['status']) => {
    switch (status) {
      case 'never_reviewed':
        return <span className="inline-block px-2 py-1 text-xs font-medium bg-purple-100 text-purple-700 rounded">Never reviewed</span>
      case 'overdue_90d':
        return <span className="inline-block px-2 py-1 text-xs font-medium bg-red-100 text-red-700 rounded">90 days overdue</span>
      case 'overdue_60d':
        return <span className="inline-block px-2 py-1 text-xs font-medium bg-orange-100 text-orange-700 rounded">60 days overdue</span>
      case 'overdue_30d':
        return <span className="inline-block px-2 py-1 text-xs font-medium bg-yellow-100 text-yellow-700 rounded">30 days overdue</span>
      default:
        return <span className="inline-block px-2 py-1 text-xs font-medium bg-green-100 text-green-700 rounded">Current</span>
    }
  }

  if (loading) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h2 className="text-xl font-semibold mb-4">Review Queue</h2>
        <div className="space-y-2">
          <div className="h-32 bg-gray-200 rounded animate-pulse" />
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-white rounded-lg border border-red-200 p-6">
        <h2 className="text-xl font-semibold mb-4 text-red-700">Error Loading Review Queue</h2>
        <p className="text-red-600 mb-4">{error}</p>
        <button
          onClick={refetch}
          className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition-colors"
        >
          Retry
        </button>
      </div>
    )
  }

  if (queue.length === 0) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold">Review Queue</h2>
          <span className="px-2 py-1 text-xs font-medium bg-green-100 text-green-700 rounded">
            All caught up! 🎉
          </span>
        </div>
        <p className="text-gray-500 text-center py-8">
          No notes to review — check back in a few weeks!
        </p>
        <div className="mt-4">
          <button
            onClick={handleSurpriseMe}
            className="w-full px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700 transition-colors"
          >
            🎲 Surprise Me
          </button>
        </div>
      </div>
    )
  }

  return (
    <>
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        {/* Header with badge */}
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold">Review Queue</h2>
          <span className={`px-2 py-1 text-xs font-medium rounded ${
            totalDue > 5 ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'
          }`}>
            {totalDue} due
          </span>
        </div>

        {/* Progress ring (CSS-only circle) */}
        <div className="flex items-center justify-center mb-6">
          <div className="relative w-32 h-32">
            <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
              {/* Background circle */}
              <circle
                cx="50"
                cy="50"
                r="45"
                fill="none"
                stroke="#e5e7eb"
                strokeWidth="8"
              />
              {/* Progress circle */}
              <circle
                cx="50"
                cy="50"
                r="45"
                fill="none"
                stroke="#3b82f6"
                strokeWidth="8"
                strokeDasharray={`${progressPercent * 2.827} ${(100 - progressPercent) * 2.827}`}
                strokeLinecap="round"
              />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-2xl font-bold text-gray-700">{progressPercent}%</span>
            </div>
          </div>
        </div>

        {/* Current note */}
        {currentNote && (
          <div className="border border-gray-200 rounded-lg p-4 mb-4">
            <div className="flex items-start justify-between mb-2">
              <h3 className="text-lg font-medium text-gray-900">{currentNote.title}</h3>
              {getStatusBadge(currentNote.status)}
            </div>
            <p className="text-sm text-gray-500 mb-4 line-clamp-2">
              {currentNote.preview || 'No preview available'}
            </p>
            <a
              href={`obsidian://open?vault=${encodeURIComponent(vaultName)}&file=${encodeURIComponent(currentNote.relativePath)}`}
              className="text-sm text-blue-600 hover:text-blue-800 mb-4 inline-block"
              target="_blank"
              rel="noopener noreferrer"
            >
              📝 Open in Obsidian
            </a>
            <div className="flex gap-2 mt-4">
              <button
                onClick={handleMarkReviewed}
                disabled={markingReviewed}
                className="flex-1 px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {markingReviewed ? 'Marking...' : '✓ Mark Reviewed'}
              </button>
              <button
                onClick={handleSkip}
                disabled={markingReviewed}
                className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Skip
              </button>
            </div>
          </div>
        )}

        {/* Queue summary */}
        <p className="text-sm text-gray-600 mb-4">
          {queue.length} {queue.length === 1 ? 'note' : 'notes'} to review
          {neverReviewed > 0 && ` • ${neverReviewed} never reviewed`}
        </p>

        {/* Surprise Me button */}
        <button
          onClick={handleSurpriseMe}
          className="w-full px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700 transition-colors"
        >
          🎲 Surprise Me
        </button>
      </div>

      {/* Surprise Me Modal */}
      {showSurpriseModal && surpriseNote && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-2xl w-full p-6">
            <div className="flex items-start justify-between mb-4">
              <h3 className="text-2xl font-semibold text-gray-900">{surpriseNote.title}</h3>
              <button
                onClick={() => setShowSurpriseModal(false)}
                className="text-gray-400 hover:text-gray-600 text-2xl leading-none"
              >
                ×
              </button>
            </div>
            <div className="mb-4">
              {getStatusBadge(surpriseNote.status)}
            </div>
            <p className="text-gray-600 mb-4">
              {surpriseNote.preview || 'No preview available'}
            </p>
            <a
              href={`obsidian://open?vault=${encodeURIComponent(vaultName)}&file=${encodeURIComponent(surpriseNote.relativePath)}`}
              className="text-blue-600 hover:text-blue-800 mb-4 inline-block"
              target="_blank"
              rel="noopener noreferrer"
            >
              📝 Open in Obsidian
            </a>
            <div className="flex gap-2 mt-6">
              <button
                onClick={handleMarkSurpriseReviewed}
                disabled={markingReviewed}
                className="flex-1 px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {markingReviewed ? 'Marking...' : '✓ Mark Reviewed'}
              </button>
              <button
                onClick={() => setShowSurpriseModal(false)}
                disabled={markingReviewed}
                className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
