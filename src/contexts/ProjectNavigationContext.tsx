import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { useLocation } from 'react-router-dom'
import { ContextSwitchModal } from '../components/ContextSwitchModal'

interface ProjectNavigationContextValue {
  previousProjectSlug: string | null
  setPreviousProjectSlug: (slug: string | null) => void
}

const ProjectNavigationContext = createContext<ProjectNavigationContextValue | null>(null)

export function useProjectNavigation() {
  const context = useContext(ProjectNavigationContext)
  if (!context) {
    throw new Error('useProjectNavigation must be used within ProjectNavigationProvider')
  }
  return context
}

interface ProjectNavigationProviderProps {
  children: ReactNode
}

const SKIP_PREF_KEY = 'cortex-skip-context-switch'

export function ProjectNavigationProvider({ children }: ProjectNavigationProviderProps) {
  const location = useLocation()
  const [previousProjectSlug, setPreviousProjectSlug] = useState<string | null>(null)
  const [currentProjectSlug, setCurrentProjectSlug] = useState<string | null>(null)
  const [pendingNavigation, setPendingNavigation] = useState<string | null>(null)
  const [showModal, setShowModal] = useState(false)
  const [previousProjectName, setPreviousProjectName] = useState<string>('')

  // Track project navigation
  useEffect(() => {
    const match = location.pathname.match(/^\/projects\/([^/]+)$/)
    const newSlug = match ? decodeURIComponent(match[1]) : null

    // Only trigger modal when switching between different projects
    if (newSlug && currentProjectSlug && newSlug !== currentProjectSlug) {
      // Check if user has disabled brain dumps
      const skipPreference = localStorage.getItem(SKIP_PREF_KEY) === 'true'

      if (!skipPreference) {
        // Show modal for previous project
        setPendingNavigation(newSlug)
        setPreviousProjectName(currentProjectSlug)
        setShowModal(true)
      } else {
        // Skip modal, proceed with navigation
        setPreviousProjectSlug(currentProjectSlug)
        setCurrentProjectSlug(newSlug)
      }
    } else if (newSlug) {
      // First project visit or navigating from non-project page
      setCurrentProjectSlug(newSlug)
    } else {
      // Navigating away from projects
      setCurrentProjectSlug(null)
    }
  }, [location.pathname, currentProjectSlug])

  async function handleContextDumpSubmit(data: { doing: string; blocking: string; next: string }) {
    if (!previousProjectName) return

    try {
      await fetch(`/api/projects/${encodeURIComponent(previousProjectName)}/context-dump`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
    } catch (err) {
      console.error('Failed to save context dump:', err)
      // Continue navigation even if save fails (best effort)
    }

    // Complete navigation
    setPreviousProjectSlug(previousProjectName)
    if (pendingNavigation) {
      setCurrentProjectSlug(pendingNavigation)
    }
    setShowModal(false)
    setPendingNavigation(null)
  }

  function handleContextDumpSkip() {
    // Complete navigation without saving
    if (previousProjectName) {
      setPreviousProjectSlug(previousProjectName)
    }
    if (pendingNavigation) {
      setCurrentProjectSlug(pendingNavigation)
    }
    setShowModal(false)
    setPendingNavigation(null)
  }

  return (
    <ProjectNavigationContext.Provider value={{ previousProjectSlug, setPreviousProjectSlug }}>
      {children}
      {showModal && previousProjectName && (
        <ContextSwitchModal
          previousProject={{ slug: previousProjectName, name: previousProjectName }}
          onSubmit={handleContextDumpSubmit}
          onSkip={handleContextDumpSkip}
        />
      )}
    </ProjectNavigationContext.Provider>
  )
}
