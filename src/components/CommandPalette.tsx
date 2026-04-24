import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Command } from 'cmdk'
import './CommandPalette.css'

interface Project {
  name: string
  slug: string
  path: string
}

interface CommandPaletteProps {
  open: boolean
  onClose: () => void
}

export function CommandPalette({ open, onClose }: CommandPaletteProps) {
  const navigate = useNavigate()
  const [search, setSearch] = useState('')
  const [projects, setProjects] = useState<Project[]>([])
  const [isLoading, setIsLoading] = useState(false)

  // Load projects when palette opens
  useEffect(() => {
    if (open) {
      setSearch('')
      loadProjects()
    }
  }, [open])

  const loadProjects = async () => {
    try {
      const response = await fetch('/api/projects')
      const data = await response.json()
      setProjects(data || [])
    } catch (error) {
      console.error('Failed to load projects:', error)
      setProjects([])
    }
  }

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && open) {
        onClose()
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [open, onClose])

  const handleSelect = async (action: string, value?: string) => {
    // Handle navigation
    if (action === 'navigate') {
      navigate(value || '/')
      onClose()
      return
    }

    // Handle project navigation
    if (action === 'project' && value) {
      navigate(`/projects`)
      onClose()
      return
    }

    // Handle actions
    if (action === 'wiki-lint') {
      setIsLoading(true)
      try {
        await fetch('/api/wiki/lint', { method: 'POST' })
        showToast('Wiki lint completed', 'success')
      } catch (error) {
        showToast('Failed to run wiki lint', 'error')
      } finally {
        setIsLoading(false)
      }
      onClose()
      return
    }

    if (action === 'weekly-review') {
      setIsLoading(true)
      try {
        await fetch('/api/weekly-review', { method: 'POST' })
        showToast('Weekly review generated', 'success')
      } catch (error) {
        showToast('Failed to generate weekly review', 'error')
      } finally {
        setIsLoading(false)
      }
      onClose()
      return
    }

    if (action === 'capture-focus') {
      // Focus the QuickCapture input
      const captureInput = document.querySelector('[data-testid="capture-input"]') as HTMLInputElement
      if (captureInput) {
        captureInput.focus()
      }
      onClose()
      return
    }
  }

  // Handle "Capture: " prefix for quick capture
  const handleKeyDown = async (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && search.toLowerCase().startsWith('capture: ')) {
      e.preventDefault()
      const text = search.slice(9).trim() // Remove "Capture: " prefix
      if (text) {
        setIsLoading(true)
        try {
          await fetch('/api/capture', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text })
          })
          showToast('Captured!', 'success')
          onClose()
        } catch (error) {
          showToast('Failed to capture', 'error')
        } finally {
          setIsLoading(false)
        }
      }
    }
  }

  const showToast = (message: string, type: 'success' | 'error') => {
    // Create a simple toast notification
    const toast = document.createElement('div')
    toast.className = `fixed top-4 right-4 px-6 py-3 rounded-lg shadow-lg animate-fade-in z-[10000] ${
      type === 'success' ? 'bg-green-500 text-white' : 'bg-red-500 text-white'
    }`
    toast.textContent = message
    document.body.appendChild(toast)
    setTimeout(() => {
      toast.remove()
    }, 2000)
  }

  if (!open) return null

  return (
    <div
      className="fixed inset-0 bg-black/50 z-[9999] flex items-start justify-center pt-[20vh]"
      onClick={onClose}
    >
      <div onClick={(e) => e.stopPropagation()}>
        <Command
          className="command-palette"
          onKeyDown={handleKeyDown}
          shouldFilter={!search.toLowerCase().startsWith('capture: ')}
        >
          <Command.Input
            value={search}
            onValueChange={setSearch}
            placeholder={
              search.toLowerCase().startsWith('capture: ')
                ? 'Type your note and press Enter...'
                : 'Search or type "Capture: " to quick capture...'
            }
            className="command-input"
            autoFocus
          />
          <Command.List className="command-list">
            {!search.toLowerCase().startsWith('capture: ') && (
              <>
                <Command.Empty className="command-empty">No results found.</Command.Empty>

                <Command.Group heading="Navigate" className="command-group">
                  <Command.Item onSelect={() => handleSelect('navigate', '/')} className="command-item">
                    <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                    </svg>
                    Go to Home
                  </Command.Item>
                  <Command.Item onSelect={() => handleSelect('navigate', '/projects')} className="command-item">
                    <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                    </svg>
                    Go to Projects
                  </Command.Item>
                  <Command.Item onSelect={() => handleSelect('navigate', '/deadlines')} className="command-item">
                    <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    Go to Deadlines
                  </Command.Item>
                  <Command.Item onSelect={() => handleSelect('navigate', '/knowledge')} className="command-item">
                    <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                    </svg>
                    Go to Knowledge
                  </Command.Item>
                  <Command.Item onSelect={() => handleSelect('navigate', '/learning')} className="command-item">
                    <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                    </svg>
                    Go to Learning
                  </Command.Item>
                </Command.Group>

                {projects.length > 0 && (
                  <Command.Group heading="Projects" className="command-group">
                    {projects.slice(0, 10).map((project) => (
                      <Command.Item
                        key={project.slug}
                        onSelect={() => handleSelect('project', project.slug)}
                        className="command-item"
                        keywords={[project.name, project.slug]}
                      >
                        <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        Open {project.name}
                      </Command.Item>
                    ))}
                  </Command.Group>
                )}

                <Command.Group heading="Actions" className="command-group">
                  <Command.Item
                    onSelect={() => handleSelect('wiki-lint')}
                    className="command-item"
                    disabled={isLoading}
                  >
                    <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    Run Wiki Lint
                  </Command.Item>
                  <Command.Item
                    onSelect={() => handleSelect('weekly-review')}
                    className="command-item"
                    disabled={isLoading}
                  >
                    <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                    </svg>
                    Generate Weekly Review
                  </Command.Item>
                  <Command.Item onSelect={() => handleSelect('capture-focus')} className="command-item">
                    <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                    Capture to Inbox
                  </Command.Item>
                </Command.Group>
              </>
            )}
          </Command.List>
        </Command>
      </div>
    </div>
  )
}
