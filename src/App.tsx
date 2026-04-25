import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom'
import { QuickCapture } from './components/QuickCapture'
import { BrainChat } from './components/BrainChat'
import { CommandPalette } from './components/CommandPalette'
import { NavBar } from './components/NavBar'
import { HomePage } from './pages/HomePage'
import { ProjectsPage } from './pages/ProjectsPage'
import { DeadlinesPage } from './pages/DeadlinesPage'
import { KnowledgePage } from './pages/KnowledgePage'
import { LearningPage } from './pages/LearningPage'
import { FocusMode } from './pages/FocusMode'
import { KanbanBoard } from './pages/KanbanBoard'
import { useProjects } from './hooks/useProjects'
import { useTodos } from './hooks/useTodos'
import { useState, useEffect } from 'react'

function AppContent() {
  const location = useLocation()
  const { refetch: refetchProjects } = useProjects()
  const { refetch: refetchTodos } = useTodos()
  const [showBrainChat, setShowBrainChat] = useState(false)
  const [showCommandPalette, setShowCommandPalette] = useState(false)

  const currentDate = new Date().toLocaleDateString('en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
  })

  // Global Ctrl+K / Cmd+K listener for command palette
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault()
        setShowCommandPalette(true)
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [])

  // Hide NavBar and other UI elements in focus mode
  const isFocusMode = location.pathname.startsWith('/focus/')

  if (isFocusMode) {
    return (
      <Routes>
        <Route path="/focus/:slug" element={<FocusMode />} />
      </Routes>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Top bar */}
      <header className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-900">Cortex</h1>
          <div className="flex items-center gap-4">
            <button
              onClick={() => setShowBrainChat(true)}
              className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition-colors flex items-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
              </svg>
              Ask Cortex
            </button>
            <span className="text-sm text-gray-600 hidden sm:block">{currentDate}</span>
          </div>
        </div>
      </header>

      {/* Navigation */}
      <NavBar />

      {/* Quick capture (always visible) */}
      <div className="bg-white border-b border-gray-200 px-6 py-3 shadow-sm">
        <div className="max-w-7xl mx-auto">
          <QuickCapture onCapture={() => { refetchProjects(); refetchTodos() }} />
        </div>
      </div>

      {/* Page content */}
      <main>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/projects" element={<ProjectsPage />} />
          <Route path="/deadlines" element={<DeadlinesPage />} />
          <Route path="/kanban" element={<KanbanBoard />} />
          <Route path="/learning" element={<LearningPage />} />
          <Route path="/knowledge" element={<KnowledgePage />} />
        </Routes>
      </main>

      {/* BrainChat overlay */}
      {showBrainChat && <BrainChat onClose={() => setShowBrainChat(false)} />}

      {/* Command Palette */}
      <CommandPalette open={showCommandPalette} onClose={() => setShowCommandPalette(false)} />
    </div>
  )
}

function App() {
  return (
    <BrowserRouter>
      <AppContent />
    </BrowserRouter>
  )
}

export default App

