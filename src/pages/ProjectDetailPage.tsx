import { useParams, useNavigate } from 'react-router-dom'
import { useProjects } from '../hooks/useProjects'
import { ProjectDetailView } from '../components/ProjectDetailView'

export function ProjectDetailPage() {
  const { slug } = useParams<{ slug: string }>()
  const navigate = useNavigate()
  const { projects, loading } = useProjects()

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="bg-white rounded-xl border border-gray-200 p-8 animate-pulse">
          <div className="h-6 w-64 bg-gray-200 rounded mb-4" />
          <div className="h-4 w-full bg-gray-200 rounded mb-2" />
          <div className="h-4 w-3/4 bg-gray-200 rounded" />
        </div>
      </div>
    )
  }

  // Find project by slug (name)
  const project = projects.find(p => p.name === decodeURIComponent(slug || ''))

  if (!project) {
    return (
      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="bg-red-50 border border-red-200 rounded-xl p-6">
          <p className="font-medium text-red-800">Project not found</p>
          <p className="text-sm text-red-700 mt-1">
            The project "{slug}" could not be found.
          </p>
          <button
            onClick={() => navigate('/projects')}
            className="mt-3 px-3 py-1.5 text-sm font-medium text-red-700 bg-red-100 rounded-lg hover:bg-red-200 transition-colors"
          >
            Back to Projects
          </button>
        </div>
      </div>
    )
  }

  return (
    <ProjectDetailView
      project={project}
      onClose={() => navigate('/projects')}
    />
  )
}
