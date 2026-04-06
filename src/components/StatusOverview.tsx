import { Project } from '../types'

interface StatusOverviewProps {
  projects: Project[]
}

export function StatusOverview({ projects }: StatusOverviewProps) {
  const activeCount = projects.filter(p => p.status === 'active').length
  const staleCount = projects.filter(p => p.status === 'stale').length
  const archivedCount = projects.filter(p => p.status === 'archived').length
  const totalTodos = projects.reduce((sum, p) => sum + p.openTodos, 0)

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4 mb-6">
      <div className="flex flex-wrap gap-4 items-center">
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-green-100 text-green-800">
            {activeCount} Active
          </span>
        </div>

        <div className="flex items-center gap-2">
          <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-amber-100 text-amber-800">
            {staleCount} Stale
          </span>
        </div>

        <div className="flex items-center gap-2">
          <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-gray-100 text-gray-800">
            {archivedCount} Archived
          </span>
        </div>

        <div className="flex items-center gap-2 ml-auto">
          <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-blue-100 text-blue-800">
            {totalTodos} Open TODOs
          </span>
        </div>
      </div>
    </div>
  )
}
