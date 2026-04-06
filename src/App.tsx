import { useProjects } from './hooks/useProjects'
import { ProjectCard } from './components/ProjectCard'
import { StatusOverview } from './components/StatusOverview'
import { QuickCapture } from './components/QuickCapture'

function App() {
  const { projects, loading, error, refetch } = useProjects()

  // Get current date formatted
  const currentDate = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  })

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Top bar */}
      <header className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-900">Cortex</h1>
          <span className="text-sm text-gray-600">{currentDate}</span>
        </div>
      </header>

      {/* QuickCapture */}
      <div className="bg-white border-b border-gray-200 px-6 py-3 shadow-sm">
        <div className="max-w-7xl mx-auto">
          <QuickCapture onCapture={refetch} />
        </div>
      </div>

      {/* Main content */}
      <main className="max-w-7xl mx-auto px-6 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left column: Stats + Project cards */}
          <div className="lg:col-span-2">
            {/* Error state */}
            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h3 className="text-sm font-medium text-red-800">Error loading projects</h3>
                    <p className="mt-1 text-sm text-red-700">{error}</p>
                  </div>
                  <button
                    onClick={refetch}
                    className="ml-4 px-3 py-1 text-sm font-medium text-red-700 bg-red-100 rounded-md hover:bg-red-200 transition-colors"
                  >
                    Retry
                  </button>
                </div>
              </div>
            )}

            {/* Loading state */}
            {loading && !error && (
              <>
                <div className="bg-white rounded-lg border border-gray-200 p-4 mb-6 animate-pulse">
                  <div className="flex gap-4">
                    <div className="h-8 w-24 bg-gray-200 rounded-full"></div>
                    <div className="h-8 w-24 bg-gray-200 rounded-full"></div>
                    <div className="h-8 w-24 bg-gray-200 rounded-full"></div>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-6">
                  {[1, 2, 3].map(i => (
                    <div key={i} className="bg-white rounded-lg border border-gray-200 p-5 animate-pulse">
                      <div className="h-6 w-48 bg-gray-200 rounded mb-3"></div>
                      <div className="h-4 w-full bg-gray-200 rounded mb-2"></div>
                      <div className="h-4 w-3/4 bg-gray-200 rounded mb-4"></div>
                      <div className="h-20 bg-gray-200 rounded"></div>
                    </div>
                  ))}
                </div>
              </>
            )}

            {/* Loaded state */}
            {!loading && !error && (
              <>
                <StatusOverview projects={projects} />

                {projects.length === 0 ? (
                  <div className="bg-white rounded-lg border border-gray-200 p-8 text-center">
                    <p className="text-gray-600 mb-2">No projects found</p>
                    <p className="text-sm text-gray-500">
                      Check your configured projects directory
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 gap-6">
                    {projects.map(project => (
                      <ProjectCard key={project.path} project={project} />
                    ))}
                  </div>
                )}
              </>
            )}
          </div>

          {/* Right column: Sidebar (TODO aggregator + deadline timeline) */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-lg border border-gray-200 p-5">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">TODO Aggregator</h2>
              <p className="text-sm text-gray-500 italic">Coming soon</p>
            </div>

            <div className="bg-white rounded-lg border border-gray-200 p-5 mt-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Deadline Timeline</h2>
              <p className="text-sm text-gray-500 italic">Coming soon</p>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}

export default App
