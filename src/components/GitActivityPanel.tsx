import { useGitActivity } from '../hooks/useGitActivity'

export function GitActivityPanel() {
  const { data, loading, error } = useGitActivity()

  if (loading) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-6 animate-pulse">
        <div className="h-6 w-48 bg-gray-200 rounded mb-4"></div>
        <div className="h-32 bg-gray-200 rounded"></div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-2">Git Activity</h2>
        <p className="text-sm text-red-600">{error}</p>
      </div>
    )
  }

  if (!data) {
    return null
  }

  // Build 90-day grid data (Mon-Sun, last 13 weeks)
  const heatmapGrid = buildHeatmapGrid(data.heatmap)

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6">
      <h2 className="text-lg font-semibold text-gray-900 mb-4">Git Activity</h2>

      {/* Heatmap */}
      <div className="mb-6">
        <div className="flex gap-1">
          {/* Day labels */}
          <div className="flex flex-col gap-1 text-xs text-gray-500 mr-1">
            <div className="h-3"></div>
            <div className="h-3 flex items-center">Mon</div>
            <div className="h-3"></div>
            <div className="h-3 flex items-center">Wed</div>
            <div className="h-3"></div>
            <div className="h-3 flex items-center">Fri</div>
            <div className="h-3"></div>
          </div>

          {/* Grid */}
          <div className="flex-1">
            {/* Month labels */}
            <div className="flex gap-1 mb-1 text-xs text-gray-500 h-3">
              {heatmapGrid.monthLabels.map((label, i) => (
                <div key={i} style={{ width: '12px' }}>
                  {label}
                </div>
              ))}
            </div>

            {/* Cells grid */}
            <div className="grid grid-cols-13 gap-1">
              {heatmapGrid.cells.map((cell, i) => (
                <div
                  key={i}
                  className={`w-3 h-3 rounded-sm ${getColorClass(cell.count)}`}
                  title={cell.count > 0 ? `${cell.date}: ${cell.count} commit${cell.count > 1 ? 's' : ''}` : cell.date}
                  style={{ gridColumn: cell.column + 1, gridRow: cell.row + 1 }}
                />
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="flex items-center gap-4 mb-6 text-sm text-gray-700">
        <span>
          <span className="font-semibold">{data.totalCommitsLast30Days}</span> commits in the last 30 days
        </span>
        {data.streak > 0 && (
          <span>
            🔥 <span className="font-semibold">{data.streak}</span> day streak
          </span>
        )}
      </div>

      {/* Per-project list */}
      {data.projects.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-medium text-gray-700 mb-2">Recent Activity by Project</h3>
          {data.projects.map(project => (
            <div key={project.name} className="flex items-start gap-3 py-2 border-t border-gray-100">
              <button
                onClick={() => {
                  window.location.href = `vscode://file/${project.path}`
                }}
                className="text-sm font-medium text-blue-600 hover:text-blue-800 transition-colors"
              >
                {project.name}
              </button>

              {project.lastCommitDate ? (
                <>
                  <span className="text-sm text-gray-600 flex-1 truncate">
                    {truncate(project.lastCommitMessage || '', 60)}
                  </span>
                  <span className="text-xs text-gray-500 whitespace-nowrap">
                    {getRelativeDate(project.lastCommitDate)}
                  </span>
                </>
              ) : (
                <span className="text-sm text-gray-400 italic">No git repository</span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

interface HeatmapCell {
  date: string
  count: number
  column: number
  row: number
}

interface HeatmapGrid {
  cells: HeatmapCell[]
  monthLabels: string[]
}

function buildHeatmapGrid(heatmap: Record<string, number>): HeatmapGrid {
  const cells: HeatmapCell[] = []
  const monthLabels: string[] = []

  // Calculate start date (90 days ago) and align to Monday
  const today = new Date()
  const startDate = new Date(today)
  startDate.setDate(startDate.getDate() - 90)

  // Align to Monday
  const dayOfWeek = startDate.getDay()
  const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1 // 0 = Sunday
  startDate.setDate(startDate.getDate() - daysToMonday)

  // Build grid (13 weeks × 7 days)
  let currentMonth = ''
  for (let week = 0; week < 13; week++) {
    // Check month label
    const weekDate = new Date(startDate)
    weekDate.setDate(weekDate.getDate() + week * 7)
    const monthName = weekDate.toLocaleDateString('en-US', { month: 'short' })

    if (monthName !== currentMonth) {
      monthLabels[week] = monthName
      currentMonth = monthName
    } else {
      monthLabels[week] = ''
    }

    for (let day = 0; day < 7; day++) {
      const date = new Date(startDate)
      date.setDate(date.getDate() + week * 7 + day)
      const dateStr = date.toISOString().substring(0, 10)

      cells.push({
        date: dateStr,
        count: heatmap[dateStr] || 0,
        column: week,
        row: day
      })
    }
  }

  return { cells, monthLabels }
}

function getColorClass(count: number): string {
  if (count === 0) return 'bg-gray-800'
  if (count <= 2) return 'bg-green-900'
  if (count <= 5) return 'bg-green-700'
  return 'bg-green-500'
}

function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text
  return text.substring(0, maxLength - 3) + '...'
}

function getRelativeDate(dateStr: string): string {
  const date = new Date(dateStr)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

  if (diffDays === 0) return 'today'
  if (diffDays === 1) return 'yesterday'
  if (diffDays < 7) return `${diffDays} days ago`
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`
  return `${Math.floor(diffDays / 30)} months ago`
}
