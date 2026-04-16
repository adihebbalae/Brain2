import { useState, FormEvent } from 'react'
import { useWiki } from '../hooks/useWiki'

export function WikiPanel() {
  const {
    wikiExists,
    pages,
    loading,
    error,
    gaps,
    gapsLoading,
    query,
    lint,
    ingest,
    analyzeGaps,
  } = useWiki()

  const [queryInput, setQueryInput] = useState('')
  const [queryResult, setQueryResult] = useState<{ answer: string; citations: string[] } | null>(null)
  const [queryLoading, setQueryLoading] = useState(false)
  const [queryError, setQueryError] = useState<string | null>(null)

  const [lintResult, setLintResult] = useState<{ orphans: string[]; stale: string[]; gaps: string[]; healthScore: number } | null>(null)
  const [lintLoading, setLintLoading] = useState(false)

  const [ingestPath, setIngestPath] = useState('')
  const [ingestStatus, setIngestStatus] = useState<string | null>(null)
  const [ingestLoading, setIngestLoading] = useState(false)

  const [gapsStatus, setGapsStatus] = useState<string | null>(null)
  const [addingToInbox, setAddingToInbox] = useState<string | null>(null)

  // Show empty state when wiki doesn't exist
  if (!loading && !wikiExists) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold">🧠 Wiki</h2>
        </div>
        <div className="text-center py-8">
          <p className="text-gray-600 mb-4">No wiki yet — ingest a file to start</p>
          <div className="flex gap-2 max-w-md mx-auto">
            <input
              type="text"
              value={ingestPath}
              onChange={e => setIngestPath(e.target.value)}
              placeholder="Source file path..."
              className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
              disabled={ingestLoading}
            />
            <button
              onClick={handleIngest}
              disabled={!ingestPath.trim() || ingestLoading}
              className="px-4 py-2 text-sm bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:opacity-50"
            >
              {ingestLoading ? 'Ingesting...' : 'Ingest'}
            </button>
          </div>
          {ingestStatus && (
            <p className="mt-3 text-sm text-gray-700">{ingestStatus}</p>
          )}
        </div>
      </div>
    )
  }

  const handleQuery = async (e: FormEvent) => {
    e.preventDefault()
    if (!queryInput.trim()) return

    setQueryLoading(true)
    setQueryError(null)
    setQueryResult(null)

    const result = await query(queryInput.trim())

    if (result.error) {
      setQueryError(result.error)
    } else {
      setQueryResult(result)
    }

    setQueryLoading(false)
  }

  const handleLint = async () => {
    setLintLoading(true)
    try {
      const result = await lint()
      setLintResult(result)
    } catch (err) {
      console.error('Lint error:', err)
    } finally {
      setLintLoading(false)
    }
  }

  async function handleIngest() {
    if (!ingestPath.trim()) return

    setIngestLoading(true)
    setIngestStatus(null)

    const result = await ingest(ingestPath.trim())

    if (result.error) {
      setIngestStatus(`❌ ${result.error}`)
    } else {
      const created = result.pagesCreated.length
      const updated = result.pagesUpdated.length
      setIngestStatus(`✅ Created ${created} pages, updated ${updated} pages`)
      setIngestPath('')
    }

    setIngestLoading(false)
    setTimeout(() => setIngestStatus(null), 5000)
  }

  async function handleAnalyzeGaps() {
    setGapsStatus(null)
    const result = await analyzeGaps()

    if (result.error) {
      setGapsStatus(`❌ ${result.error}`)
    } else {
      setGapsStatus(`✅ Found ${result.gaps.length} gaps`)
    }

    setTimeout(() => setGapsStatus(null), 5000)
  }

  async function handleAddToInbox(topic: string) {
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

      // Brief toast feedback - we can reuse the gapsStatus for this
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

  const getHealthBadgeClasses = (score: number) => {
    if (score > 80) return 'bg-green-100 text-green-800'
    if (score >= 50) return 'bg-yellow-100 text-yellow-800'
    return 'bg-red-100 text-red-800'
  }

  const getStatusBadgeClasses = (status: string) => {
    switch (status) {
      case 'mature':
        return 'bg-green-100 text-green-800'
      case 'developing':
        return 'bg-blue-100 text-blue-800'
      case 'seedling':
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <h2 className="text-xl font-semibold">🧠 Wiki</h2>
          {lintResult ? (
            <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${getHealthBadgeClasses(lintResult.healthScore)}`}>
              Health: {lintResult.healthScore}
            </span>
          ) : (
            <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
              Not linted
            </span>
          )}
        </div>
        <button
          onClick={handleLint}
          disabled={lintLoading}
          className="px-3 py-1.5 text-sm bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 disabled:opacity-50"
        >
          {lintLoading ? 'Linting...' : 'Lint'}
        </button>
      </div>

      {/* Query section */}
      <form onSubmit={handleQuery} className="mb-4">
        <div className="flex gap-2">
          <input
            type="text"
            value={queryInput}
            onChange={e => setQueryInput(e.target.value)}
            placeholder="Ask a question..."
            className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
            disabled={queryLoading}
          />
          <button
            type="submit"
            disabled={!queryInput.trim() || queryLoading}
            className="px-4 py-2 text-sm bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:opacity-50"
          >
            {queryLoading ? '...' : 'Ask'}
          </button>
        </div>

        {queryLoading && (
          <p className="mt-2 text-xs text-gray-500">Thinking...</p>
        )}

        {queryError && (
          <p className="mt-2 text-xs text-red-600">{queryError}</p>
        )}

        {queryResult && (
          <div className="mt-3 p-3 bg-gray-50 rounded-md">
            <p className="text-sm text-gray-800">{queryResult.answer}</p>
            {queryResult.citations.length > 0 && (
              <div className="mt-2">
                <span className="text-xs text-gray-600">Cited: </span>
                {queryResult.citations.map((citation, idx) => (
                  <span key={idx} className="inline-block ml-1 px-2 py-0.5 text-xs bg-indigo-100 text-indigo-700 rounded">
                    [[{citation}]]
                  </span>
                ))}
              </div>
            )}
          </div>
        )}
      </form>

      {/* Pages list */}
      <div className="mb-4 border-t border-gray-200 pt-4">
        <h3 className="text-sm font-semibold text-gray-700 mb-2">Pages ({pages.length})</h3>
        {loading ? (
          <div className="space-y-2">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-6 bg-gray-200 rounded animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="space-y-1 max-h-[300px] overflow-y-auto">
            {pages.map(page => (
              <div key={page.name} className="flex items-start gap-2 py-1 text-sm">
                <span className="text-gray-400">•</span>
                <div className="flex-1 min-w-0">
                  <span className="font-medium text-gray-900">{page.name}</span>
                  {page.summary && (
                    <span className="text-gray-600"> — {page.summary}</span>
                  )}
                </div>
                <span className={`ml-2 px-2 py-0.5 text-xs rounded ${getStatusBadgeClasses(page.status)}`}>
                  {page.status === 'seedling' ? '🌱' : page.status === 'developing' ? '🌿' : '🌳'}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Gap List section */}
      <div className="border-t border-gray-200 pt-4 mb-4">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-semibold text-gray-700">📚 Learning Gaps</h3>
          <button
            onClick={handleAnalyzeGaps}
            disabled={gapsLoading}
            className="px-3 py-1.5 text-sm bg-indigo-100 text-indigo-700 rounded-md hover:bg-indigo-200 disabled:opacity-50"
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
          <p className="text-sm text-gray-600 py-4 text-center">
            Click Analyze to find gaps
          </p>
        )}

        {gaps && gaps.length === 0 && !gapsLoading && (
          <p className="text-sm text-gray-600 py-4 text-center">
            No knowledge gaps found — your wiki is complete! 🎉
          </p>
        )}

        {gaps && gaps.length > 0 && (
          <div className="space-y-4 max-h-[400px] overflow-y-auto">
            {gaps.map((gap, idx) => (
              <div key={idx} className="border border-gray-200 rounded-md p-3">
                <div className="flex items-start justify-between mb-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium text-gray-500">
                      Priority {gap.priority}
                    </span>
                    <span className="text-sm font-semibold text-gray-900">{gap.topic}</span>
                  </div>
                </div>
                <p className="text-xs text-gray-600 mb-2">{gap.reason}</p>

                {gap.resources && gap.resources.length > 0 && (
                  <div className="space-y-1 mb-2">
                    {gap.resources.map((resource, rIdx) => (
                      <a
                        key={rIdx}
                        href={resource.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block text-xs text-indigo-600 hover:text-indigo-800 hover:underline"
                      >
                        {resource.type === 'video' ? '▶' : '📄'} {resource.title}
                      </a>
                    ))}
                  </div>
                )}

                <button
                  onClick={() => handleAddToInbox(gap.topic)}
                  disabled={addingToInbox === gap.topic}
                  className="px-3 py-1 text-xs bg-gray-100 text-gray-700 rounded hover:bg-gray-200 disabled:opacity-50"
                >
                  {addingToInbox === gap.topic ? 'Adding...' : '+ Add to Inbox'}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Ingest section */}
      <div className="border-t border-gray-200 pt-4">
        <h3 className="text-sm font-semibold text-gray-700 mb-2">Ingest</h3>
        <div className="flex gap-2">
          <input
            type="text"
            value={ingestPath}
            onChange={e => setIngestPath(e.target.value)}
            placeholder="File path..."
            className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
            disabled={ingestLoading}
          />
          <button
            onClick={handleIngest}
            disabled={!ingestPath.trim() || ingestLoading}
            className="px-4 py-2 text-sm bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:opacity-50"
          >
            {ingestLoading ? 'Ingesting...' : 'Ingest'}
          </button>
        </div>
        {ingestStatus && (
          <p className="mt-2 text-xs text-gray-700">{ingestStatus}</p>
        )}
      </div>

      {/* Error state */}
      {error && (
        <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-md">
          <p className="text-sm text-red-800">{error}</p>
        </div>
      )}
    </div>
  )
}
