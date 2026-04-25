import { useState } from 'react'
import { ErrorBoundary } from '../components/ErrorBoundary'
import { WikiPanel } from '../components/WikiPanel'
import { KnowledgeGraph } from '../components/KnowledgeGraph'
import { CanvasPanel } from '../components/CanvasPanel'
import { ChatExplorer } from '../components/ChatExplorer'
import { ImportsPanel } from '../components/ImportsPanel'
import { useProjects } from '../hooks/useProjects'

type KnowledgeTab = 'wiki' | 'imports' | 'graph' | 'canvases' | 'chats'

const TABS: { id: KnowledgeTab; label: string }[] = [
  { id: 'wiki', label: 'Wiki' },
  { id: 'imports', label: 'Imports' },
  { id: 'graph', label: 'Knowledge Graph' },
  { id: 'canvases', label: 'Canvases' },
  { id: 'chats', label: 'Chat Exports' },
]

export function KnowledgePage() {
  const [activeTab, setActiveTab] = useState<KnowledgeTab>('wiki')
  const [wikiRefreshKey, setWikiRefreshKey] = useState(0)
  const { projects } = useProjects()
  const projectNames = projects.map(p => p.name)

  return (
    <div className="max-w-7xl mx-auto px-6 py-6">
      {/* Tab bar */}
      <div className="flex items-center gap-1 mb-6 border-b border-gray-200 pb-0">
        {TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
              activeTab === tab.id
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === 'wiki' && (
        <ErrorBoundary fallbackMessage="Error loading wiki">
          <WikiPanel key={wikiRefreshKey} />
        </ErrorBoundary>
      )}
      {activeTab === 'imports' && (
        <ErrorBoundary fallbackMessage="Error loading imports">
          <ImportsPanel onWikiUpdated={() => setWikiRefreshKey(current => current + 1)} />
        </ErrorBoundary>
      )}
      {activeTab === 'graph' && (
        <ErrorBoundary fallbackMessage="Error loading knowledge graph">
          <KnowledgeGraph />
        </ErrorBoundary>
      )}
      {activeTab === 'canvases' && (
        <ErrorBoundary fallbackMessage="Error loading canvases">
          <CanvasPanel />
        </ErrorBoundary>
      )}
      {activeTab === 'chats' && (
        <ErrorBoundary fallbackMessage="Error loading chat exports">
          <ChatExplorer projectNames={projectNames} />
        </ErrorBoundary>
      )}
    </div>
  )
}
