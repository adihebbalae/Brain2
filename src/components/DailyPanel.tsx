import { useEffect, useState } from 'react'

interface Deadline {
  id: string
  date: string
  description: string
  urgency: string
  tag?: string
}

interface CalendarEvent {
  id: string
  title: string
  start: string
  end: string
}

interface Project {
  name: string
  staleDays: number
}

interface RandomNote {
  title: string
  path: string
  preview: string
}

interface GitActivity {
  commitsToday: number
  commitsThisWeek: number
}

interface DailyContext {
  date: string
  deadlines: Deadline[]
  calendarEvents: CalendarEvent[]
  staleProjects: Project[]
  randomNotes: RandomNote[]
  gitActivity: GitActivity
}

export function DailyPanel() {
  const [context, setContext] = useState<DailyContext | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchContext = async () => {
    try {
      setError(null)
      const res = await fetch('http://localhost:3001/api/daily-context')
      if (!res.ok) throw new Error('Failed to fetch daily context')
      const data = await res.json()
      setContext(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void fetchContext()
  }, [])

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow p-6 animate-pulse">
        <div className="h-6 bg-gray-200 rounded w-1/3 mb-4"></div>
        <div className="space-y-3">
          <div className="h-4 bg-gray-200 rounded"></div>
          <div className="h-4 bg-gray-200 rounded w-5/6"></div>
          <div className="h-4 bg-gray-200 rounded w-4/6"></div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <div className="text-red-600 mb-4">⚠️ {error}</div>
        <button
          onClick={() => void fetchContext()}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
        >
          Retry
        </button>
      </div>
    )
  }

  if (!context) return null

  const formatTime = (isoString: string): string => {
    const date = new Date(isoString)
    return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
  }

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold text-gray-900">Today</h2>
        <button
          onClick={() => void fetchContext()}
          className="text-sm text-gray-500 hover:text-gray-700"
          title="Refresh random notes"
        >
          🔄
        </button>
      </div>

      <p className="text-sm text-gray-600 mb-4">{context.date}</p>

      {/* Calendar Events */}
      {context.calendarEvents.length > 0 && (
        <div className="mb-4">
          <h3 className="text-sm font-medium text-gray-700 mb-2">Calendar</h3>
          <div className="space-y-2">
            {context.calendarEvents.slice(0, 5).map(event => (
              <div key={event.id} className="text-sm border-l-2 border-blue-500 pl-2">
                <div className="font-medium text-gray-900">{event.title}</div>
                <div className="text-gray-500 text-xs">
                  {formatTime(event.start)} - {formatTime(event.end)}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Upcoming Deadlines */}
      {context.deadlines.length > 0 && (
        <div className="mb-4">
          <h3 className="text-sm font-medium text-gray-700 mb-2">Upcoming</h3>
          <div className="flex flex-wrap gap-2">
            {context.deadlines.slice(0, 3).map(deadline => (
              <span
                key={deadline.id}
                className={`inline-block px-2 py-1 text-xs rounded ${
                  deadline.urgency === 'red'
                    ? 'bg-red-100 text-red-800'
                    : deadline.urgency === 'amber'
                    ? 'bg-amber-100 text-amber-800'
                    : 'bg-green-100 text-green-800'
                }`}
              >
                {deadline.description}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Stale Projects */}
      {context.staleProjects.length > 0 && (
        <div className="mb-4">
          <h3 className="text-sm font-medium text-gray-700 mb-2">Needs Attention</h3>
          <div className="space-y-1">
            {context.staleProjects.slice(0, 2).map(project => (
              <div key={project.name} className="text-sm">
                <span className="text-gray-900">{project.name}</span>
                <span className="ml-2 text-xs px-2 py-0.5 bg-amber-100 text-amber-800 rounded">
                  {project.staleDays}d stale
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Git Activity */}
      {context.gitActivity.commitsThisWeek > 0 && (
        <div className="mb-4">
          <h3 className="text-sm font-medium text-gray-700 mb-2">Activity</h3>
          <div className="text-sm text-gray-600">
            {context.gitActivity.commitsToday > 0 && (
              <div>✅ {context.gitActivity.commitsToday} commit{context.gitActivity.commitsToday > 1 ? 's' : ''} today</div>
            )}
            <div>📊 {context.gitActivity.commitsThisWeek} commit{context.gitActivity.commitsThisWeek > 1 ? 's' : ''} this week</div>
          </div>
        </div>
      )}

      {/* Random Resurfaced Notes */}
      {context.randomNotes.length > 0 && (
        <div>
          <h3 className="text-sm font-medium text-gray-700 mb-2">Resurfaced</h3>
          <div className="space-y-2">
            {context.randomNotes.map((note, idx) => {
              const encodedPath = encodeURIComponent(note.path)
              const obsidianUrl = `obsidian://open?vault=SecondBrain&file=${encodedPath}`

              return (
                <div key={idx} className="text-sm">
                  <a
                    href={obsidianUrl}
                    className="font-medium text-blue-600 hover:text-blue-800"
                  >
                    {note.title}
                  </a>
                  <div className="text-xs text-gray-500 truncate">{note.preview}</div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Empty State */}
      {context.calendarEvents.length === 0 &&
        context.deadlines.length === 0 &&
        context.staleProjects.length === 0 &&
        context.randomNotes.length === 0 &&
        context.gitActivity.commitsThisWeek === 0 && (
          <div className="text-center text-gray-500 py-8">
            <div className="text-4xl mb-2">📅</div>
            <div className="text-sm">No context for today</div>
          </div>
        )}
    </div>
  )
}
