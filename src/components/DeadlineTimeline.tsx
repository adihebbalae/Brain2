import { useMemo } from 'react'
import { useDeadlines } from '../hooks/useDeadlines'
import { Deadline } from '../types'

interface DeadlineTimelineProps {
  compact?: boolean
}

export function DeadlineTimeline({ compact = false }: DeadlineTimelineProps) {
  const { deadlines, loading, error, refetch } = useDeadlines()

  // Split into pending and completed
  const pendingDeadlines = useMemo(
    () => deadlines.filter(d => !d.done),
    [deadlines]
  )

  const completedDeadlines = useMemo(
    () => deadlines.filter(d => d.done),
    [deadlines]
  )

  // In compact mode, show only first 5 pending
  const displayedDeadlines = useMemo(
    () => compact ? pendingDeadlines.slice(0, 5) : pendingDeadlines,
    [compact, pendingDeadlines]
  )

  const hiddenCount = compact ? Math.max(0, pendingDeadlines.length - 5) : 0

  if (loading) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h2 className="text-xl font-semibold mb-4">Deadlines</h2>
        <div className="space-y-2">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-16 bg-gray-200 rounded animate-pulse" />
          ))}
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-white rounded-lg border border-red-200 p-6">
        <h2 className="text-xl font-semibold mb-4 text-red-700">Error Loading Deadlines</h2>
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

  if (pendingDeadlines.length === 0 && completedDeadlines.length === 0) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h2 className="text-xl font-semibold mb-4">Deadlines</h2>
        <p className="text-gray-500 text-center py-8">
          📅 No upcoming deadlines
        </p>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6">
      <h2 className="text-xl font-semibold mb-4">Deadlines</h2>

      {/* Pending deadlines timeline */}
      <div className="space-y-4">
        {displayedDeadlines.map((deadline, index) => (
          <DeadlineItem
            key={deadline.id}
            deadline={deadline}
            isLast={index === displayedDeadlines.length - 1 && completedDeadlines.length === 0}
          />
        ))}
      </div>

      {/* "See all" link in compact mode */}
      {compact && hiddenCount > 0 && (
        <div className="mt-4 pt-4 border-t border-gray-200">
          <a
            href="#"
            className="text-sm text-blue-600 hover:text-blue-800 transition-colors"
          >
            See all {pendingDeadlines.length} deadlines
          </a>
        </div>
      )}

      {/* Completed deadlines */}
      {!compact && completedDeadlines.length > 0 && (
        <div className="mt-6 pt-6 border-t border-gray-200">
          <h3 className="text-sm font-medium text-gray-500 mb-4">Completed</h3>
          <div className="space-y-4">
            {completedDeadlines.map((deadline, index) => (
              <DeadlineItem
                key={deadline.id}
                deadline={deadline}
                isLast={index === completedDeadlines.length - 1}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

interface DeadlineItemProps {
  deadline: Deadline
  isLast: boolean
}

function DeadlineItem({ deadline, isLast }: DeadlineItemProps) {
  const { date, description, tag, urgency } = deadline

  // Format date for display
  const dateObj = new Date(date)
  const month = dateObj.toLocaleDateString('en-US', { month: 'short' })
  const day = dateObj.getDate()

  // Calculate relative label
  const relativeLabel = getRelativeLabel(dateObj)

  // Urgency styling
  const urgencyStyles = {
    red: {
      dotColor: 'bg-red-500',
      borderColor: 'border-red-500',
      textWeight: 'font-bold',
      textColor: 'text-gray-900'
    },
    amber: {
      dotColor: 'bg-amber-500',
      borderColor: 'border-amber-500',
      textWeight: 'font-normal',
      textColor: 'text-gray-900'
    },
    green: {
      dotColor: 'bg-green-500',
      borderColor: 'border-green-500',
      textWeight: 'font-normal',
      textColor: 'text-gray-900'
    },
    gray: {
      dotColor: 'bg-gray-400',
      borderColor: 'border-gray-300',
      textWeight: 'font-normal',
      textColor: 'text-gray-500'
    }
  }

  const style = urgencyStyles[urgency]

  return (
    <div className="flex gap-4 relative">
      {/* Left column: Date */}
      <div className="flex flex-col items-end w-20 flex-shrink-0">
        <div className="text-xs text-gray-500 uppercase">{month}</div>
        <div className="text-2xl font-semibold text-gray-900">{day}</div>
        {relativeLabel && (
          <div className="text-xs text-gray-500 italic">{relativeLabel}</div>
        )}
      </div>

      {/* Connector line and dot */}
      <div className="flex flex-col items-center flex-shrink-0">
        {/* Dot */}
        <div className={`w-3 h-3 rounded-full ${style.dotColor} z-10 mt-2`} />
        {/* Vertical line */}
        {!isLast && (
          <div className="w-px h-full bg-gray-200 flex-1 mt-1" />
        )}
      </div>

      {/* Right column: Description + tag */}
      <div className={`flex-1 pb-6 border-l-2 ${style.borderColor} pl-4 -ml-px`}>
        <div className={`${style.textWeight} ${style.textColor} ${urgency === 'gray' ? 'line-through' : ''}`}>
          {description}
        </div>
        {tag && (
          <div className="mt-2">
            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-gray-100 text-gray-600">
              {tag}
            </span>
          </div>
        )}
      </div>
    </div>
  )
}

/**
 * Returns relative label for date (Today, Tomorrow, 2 days, etc.)
 * Returns null for dates > 7 days away
 */
function getRelativeLabel(date: Date): string | null {
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const targetDate = new Date(date)
  targetDate.setHours(0, 0, 0, 0)

  const diffTime = targetDate.getTime() - today.getTime()
  const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24))

  if (diffDays === 0) return 'Today'
  if (diffDays === 1) return 'Tomorrow'
  if (diffDays === -1) return 'Yesterday'
  if (diffDays > 1 && diffDays <= 7) return `${diffDays} days`
  if (diffDays < -1 && diffDays >= -7) return `${Math.abs(diffDays)} days ago`

  return null
}
