import { useState } from 'react'
import { ErrorBoundary } from '../components/ErrorBoundary'
import { ReadingPanel } from '../components/ReadingPanel'
import { MediaPanel } from '../components/MediaPanel'
import { ChatExplorer } from '../components/ChatExplorer'
import { ReviewPanel } from '../components/ReviewPanel'
import { useWiki } from '../hooks/useWiki'
import { useProjects } from '../hooks/useProjects'

export function LearningPage() {
  const { projects } = useProjects()
  const { gaps, gapsLoading, analyzeGaps } = useWiki()
  const [gapsStatus, setGapsStatus] = useState<string | null>(null)
  const [addingToInbox, setAddingToInbox] = useState<string | null>(null)

  const projectNames = projects.map(p => p.name)

  const handleAnalyzeGaps = async () => {
    setGapsStatus(null)
    const result = await analyzeGaps()

    if (result.error) {
      setGapsStatus(`❌ ${result.error}`)
    } else {
      setGapsStatus(`✅ Found ${result.gaps.length} gaps`)
    }

    setTimeout(() => setGapsStatus(null), 5000)
  }

  const handleAddToInbox = async (topic: string) => {
    setAddingToInbox(topic)
    try {
      const response = await fetch('http://localhost:3001/api/capture', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ text: `Learn: ${topic}` }),
      })

      if (!response.ok) {
        throw new Error('Failed to add to inbox')
      }

      setGapsStatus(`✅ Added "${topic}" to inbox`)
      setTimeout(() => setGapsStatus(null), 2000)
    } catch (err) {
      console.error('Failed to add to inbox:', err)
      setGapsStatus('❌ Failed to add to inbox')
      setTimeout(() => setGapsStatus(null), 3000)
    } finally {
      setAddingToInbox(null)
    }
  }

  return (
    <div className="max-w-7xl mx-auto px-6 py-6">
      {/* Page header */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Learning & Expansion</h1>
        <p className="text-gray-600">Track knowledge gaps, reading lists, media consumption, and review queue</p>
      </div>

      {/* 2-column layout: left wider, right sidebar */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left column (2/3 width) */}
        <div className="lg:col-span-2 space-y-6">
          {/* Gap Analysis Section */}
          <ErrorBoundary fallbackMessage="Error loading knowledge gaps">
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-semibold text-gray-900">📚 Knowledge Gaps</h2>
                <button
                  onClick={handleAnalyzeGaps}
                  disabled={gapsLoading}
                  className="px-3 py-1.5 text-sm bg-indigo-100 text-indigo-700 rounded-md hover:bg-indigo-200 disabled:opacity-50 transition-colors"
                >
                  {gapsLoading ? 'Analyzing...' : 'Analyze'}
                </button>
              </div>

              {gapsLoading && (
                <p className="text-xs text-gray-500 mb-3">Analyzing... (this may take a moment)</p>
              )}

              {gapsStatus && (
                <p className="text-xs text-gray-700 mb-3">{gapsStatus}</p>
              )}

              {!gaps && !gapsLoading && (
                <p className="text-sm text-gray-600 py-8 text-center">
                  Click Analyze to find knowledge gaps in your wiki
                </p>
              )}

              {gaps && gaps.length === 0 && !gapsLoading && (
                <p className="text-sm text-gray-600 py-8 text-center">
                  No knowledge gaps found — your wiki is complete! 🎉
                </p>
              )}

              {gaps && gaps.length > 0 && (
                <div className="space-y-4 max-h-[500px] overflow-y-auto">
                  {gaps.map((gap, idx) => (
                    <div key={idx} className="border border-gray-200 rounded-md p-4 hover:border-gray-300 transition-colors">
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <span className="px-2 py-0.5 text-xs font-medium bg-indigo-100 text-indigo-700 rounded">
                            Priority {gap.priority}
                          </span>
                          <span className="text-sm font-semibold text-gray-900">{gap.topic}</span>
                        </div>
                        <button
                          onClick={() => handleAddToInbox(gap.topic)}
                          disabled={addingToInbox === gap.topic}
                          className="px-2 py-1 text-xs bg-blue-50 text-blue-700 rounded hover:bg-blue-100 disabled:opacity-50 transition-colors"
                        >
                          {addingToInbox === gap.topic ? '...' : '+ Inbox'}
                        </button>
                      </div>
                      <p className="text-xs text-gray-600 mb-3">{gap.reason}</p>

                      {gap.resources && gap.resources.length > 0 && (
                        <div className="space-y-1">
                          <p className="text-xs font-medium text-gray-700">Suggested resources:</p>
                          {gap.resources.map((resource, rIdx) => (
                            <a
                              key={rIdx}
                              href={resource.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="block text-xs text-blue-600 hover:text-blue-800 hover:underline"
                            >
                              {resource.type === 'video' ? '🎥' : '📄'} {resource.title}
                            </a>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </ErrorBoundary>

          {/* Chat Explorer */}
          <ErrorBoundary fallbackMessage="Error loading chat exports">
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <ChatExplorer projectNames={projectNames} />
            </div>
          </ErrorBoundary>
        </div>

        {/* Right column (1/3 width) */}
        <div className="space-y-6">
          {/* Reading Panel */}
          <ErrorBoundary fallbackMessage="Error loading reading list">
            <ReadingPanel />
          </ErrorBoundary>

          {/* Media Panel */}
          <ErrorBoundary fallbackMessage="Error loading media history">
            <MediaPanel />
          </ErrorBoundary>

          {/* Review Panel */}
          <ErrorBoundary fallbackMessage="Error loading review queue">
            <ReviewPanel />
          </ErrorBoundary>
        </div>
      </div>
    </div>
  )
}
