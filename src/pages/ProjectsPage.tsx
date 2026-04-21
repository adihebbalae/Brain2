import { useState, useMemo } from 'react'
import { useProjects } from '../hooks/useProjects'
import { Project } from '../types'
import { ProjectDetailView } from '../components/ProjectDetailView'

function getStatusBadgeClasses(status: Project['status']): string {
  switch (status) {
    case 'active': return 'bg-green-100 text-green-800'
    case 'stale': return 'bg-amber-100 text-amber-800'
    case 'archived': return 'bg-gray-100 text-gray-600'
    default: return 'bg-gray-100 text-gray-600'
  }
}

function getBorderClass(staleDays: number): string {
  if (staleDays > 30) return 'border-red-300'
  if (staleDays > 14) return 'border-amber-300'
  return 'border-gray-200'
}

function getRelativeTime(dateString: string): string {
  const date = new Date(dateString)
  const now = new Date()
  const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24))
  if (diffDays === 0) return 'today'
  if (diffDays === 1) return 'yesterday'
  if (diffDays < 7) return `${diffDays} days ago`
  if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`
  if (diffDays < 365) return `${Math.floor(diffDays / 30)}mo ago`
  return `${Math.floor(diffDays / 365)}y ago`
}

type Filter = 'all' | 'active' | 'stale' | 'archived'

export function ProjectsPage() {
  const { projects, loading, error, refetch } = useProjects()
  const [selectedProject, setSelectedProject] = useState<Project | null>(null)
  const [filter, setFilter] = useState<Filter>('all')
  const [search, setSearch] = useState('')

  const filtered = useMemo(() => {
    let list = projects
    if (filter !== 'all') list = list.filter(p => p.status === filter)
    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter(p =>
        p.name.toLowerCase().includes(q) ||
        p.summary?.toLowerCase().includes(q)
      )
    }
    return list
  }, [projects, filter, search])

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {[1, 2, 3, 4, 5, 6].map(i => (
            <div key={i} className="bg-white rounded-xl border border-gray-200 p-5 animate-pulse">
              <div className="h-5 w-40 bg-gray-200 rounded mb-3" />
              <div className="h-4 w-full bg-gray-200 rounded mb-2" />
              <div className="h-4 w-3/4 bg-gray-200 rounded" />
            </div>
          ))}
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="bg-red-50 border border-red-200 rounded-xl p-6 flex items-start justify-between">
          <div>
            <p className="font-medium text-red-800">Error loading projects</p>
            <p className="text-sm text-red-700 mt-1">{error}</p>
          </div>
          <button onClick={refetch} className="px-3 py-1.5 text-sm font-medium text-red-700 bg-red-100 rounded-lg hover:bg-red-200 transition-colors">
            Retry
          </button>
        </div>
      </div>
    )
  }

  const counts = {
    all: projects.length,
    active: projects.filter(p => p.status === 'active').length,
    stale: projects.filter(p => p.status === 'stale').length,
    archived: projects.filter(p => p.status === 'archived').length,
  }

  return (
    <div className="max-w-7xl mx-auto px-6 py-8">
      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-6">
        <div className="flex items-center gap-1 flex-wrap">
          {(['all', 'active', 'stale', 'archived'] as Filter[]).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded-full text-sm font-medium capitalize transition-colors ${
                filter === f
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {f} ({counts[f]})
            </button>
          ))}
        </div>
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search projects..."
          className="sm:ml-auto px-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 w-full sm:w-56"
        />
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-16 text-gray-500">
          <p className="text-4xl mb-3">📂</p>
          <p className="font-medium">No projects match your filter</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {filtered.map(project => (
            <button
              key={project.path}
              onClick={() => setSelectedProject(project)}
              className={`text-left bg-white rounded-xl border-2 ${getBorderClass(project.staleDays)} p-5 hover:shadow-md hover:border-blue-300 transition-all cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500`}
            >
              <div className="flex items-start justify-between gap-2 mb-2">
                <h3 className="text-base font-bold text-gray-900 leading-tight">{project.name}</h3>
                <span className={`shrink-0 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${getStatusBadgeClasses(project.status)}`}>
                  {project.status}
                </span>
              </div>
              <p className="text-sm text-gray-500 mb-3 line-clamp-2">
                {project.summary || 'No summary available'}
              </p>
              {project.nextSteps.length > 0 && (
                <p className="text-xs text-gray-400 truncate">
                  → {project.nextSteps[0]}
                </p>
              )}
              <div className="mt-3 pt-3 border-t border-gray-100 flex items-center justify-between text-xs text-gray-400">
                <span>{getRelativeTime(project.lastModified)}</span>
                <span className="text-blue-500 font-medium">View details →</span>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Project detail slide-in */}
      {selectedProject && (
        <ProjectDetailView
          project={selectedProject}
          onClose={() => setSelectedProject(null)}
        />
      )}
    </div>
  )
}
