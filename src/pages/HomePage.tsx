import { ErrorBoundary } from '../components/ErrorBoundary'
import { StatusOverview } from '../components/StatusOverview'
import { DailyPanel } from '../components/DailyPanel'
import { CalendarPanel } from '../components/CalendarPanel'
import { GitActivityPanel } from '../components/GitActivityPanel'
import { ReviewPanel } from '../components/ReviewPanel'
import { useProjects } from '../hooks/useProjects'

export function HomePage() {
  const { projects, loading } = useProjects()

  return (
    <div className="max-w-7xl mx-auto px-6 py-8">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left column */}
        <div className="lg:col-span-2 space-y-6">
          {!loading && <StatusOverview projects={projects} />}

          <ErrorBoundary fallbackMessage="Error loading daily context">
            <DailyPanel />
          </ErrorBoundary>

          <ErrorBoundary fallbackMessage="Error loading git activity">
            <GitActivityPanel />
          </ErrorBoundary>
        </div>

        {/* Right column */}
        <div className="lg:col-span-1 space-y-6">
          <ErrorBoundary fallbackMessage="Error loading calendar">
            <CalendarPanel />
          </ErrorBoundary>

          <ErrorBoundary fallbackMessage="Error loading review queue">
            <ReviewPanel />
          </ErrorBoundary>
        </div>
      </div>
    </div>
  )
}
