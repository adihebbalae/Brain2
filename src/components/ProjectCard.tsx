import { Project } from '../types'

interface ProjectCardProps {
  project: Project
}

function getRelativeTime(dateString: string): string {
  const date = new Date(dateString)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

  if (diffDays === 0) return 'today'
  if (diffDays === 1) return 'yesterday'
  if (diffDays < 7) return `${diffDays} days ago`
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`
  if (diffDays < 365) return `${Math.floor(diffDays / 30)} months ago`
  return `${Math.floor(diffDays / 365)} years ago`
}

function getStatusBadgeClasses(status: Project['status']): string {
  switch (status) {
    case 'active':
      return 'bg-green-100 text-green-800'
    case 'stale':
      return 'bg-amber-100 text-amber-800'
    case 'archived':
    case 'unknown':
    default:
      return 'bg-gray-100 text-gray-800'
  }
}

function getBorderClass(staleDays: number): string {
  if (staleDays > 30) return 'border-red-400'
  if (staleDays > 14) return 'border-amber-400'
  return 'border-gray-200'
}

export function ProjectCard({ project }: ProjectCardProps) {
  const borderClass = getBorderClass(project.staleDays)
  const statusBadgeClass = getStatusBadgeClasses(project.status)
  const vsCodeUrl = project.vscodeUrl

  // Show max 3 next steps
  const displayedNextSteps = project.nextSteps.slice(0, 3)

  return (
    <div
      className={`bg-white rounded-lg border-2 ${borderClass} p-5 hover:shadow-md transition-shadow`}
    >
      {/* Header with status badge */}
      <div className="flex items-start justify-between mb-3">
        <h3 className="text-xl font-bold text-gray-900">{project.name}</h3>
        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${statusBadgeClass}`}>
          {project.status}
        </span>
      </div>

      {/* Summary */}
      <p className="text-gray-600 text-sm mb-4 line-clamp-2">
        {project.summary || 'No summary available'}
      </p>

      {/* Next steps */}
      {displayedNextSteps.length > 0 && (
        <div className="mb-4">
          <h4 className="text-xs font-semibold text-gray-700 uppercase tracking-wide mb-2">
            Next Steps
          </h4>
          <ul className="space-y-1">
            {displayedNextSteps.map((step, idx) => (
              <li key={idx} className="text-sm text-gray-600 flex items-start">
                <span className="mr-2 text-gray-400">•</span>
                <span className="flex-1">{step}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between pt-4 border-t border-gray-100">
        <div className="flex items-center gap-3 text-sm text-gray-500">
          <span>{getRelativeTime(project.lastModified)}</span>
          {project.openTodos > 0 && (
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
              {project.openTodos} TODO{project.openTodos !== 1 ? 's' : ''}
            </span>
          )}
        </div>

        <a
          href={vsCodeUrl}
          className="inline-flex items-center px-3 py-1.5 text-sm font-medium text-blue-700 bg-blue-50 rounded-md hover:bg-blue-100 transition-colors"
        >
          Open in VS Code
        </a>
      </div>
    </div>
  )
}
