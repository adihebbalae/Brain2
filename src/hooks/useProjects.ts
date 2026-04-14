import { useState, useEffect, useCallback } from 'react'
import { Project } from '../types'

const API_BASE = 'http://localhost:3001'

interface UseProjectsResult {
  projects: Project[]
  loading: boolean
  error: string | null
  refetch: () => void
}

export function useProjects(): UseProjectsResult {
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchProjects = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const response = await fetch(`${API_BASE}/api/projects`)

      if (!response.ok) {
        throw new Error(`Failed to fetch projects: ${response.statusText}`)
      }

      const data = await response.json()
      setProjects(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch projects')
      console.error('Error fetching projects:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  // Fetch AI summaries for active projects after initial load
  useEffect(() => {
    if (projects.length === 0) return

    const activeProjects = projects.filter((p) => p.status === 'active')
    if (activeProjects.length === 0) return

    const fetchAiSummaries = async () => {
      try {
        const projectsPayload = activeProjects.map((p) => ({
          name: p.name,
          stateFilePath: p.stateFile || p.path, // Use stateFile if available, otherwise use path
        }))

        const response = await fetch(`${API_BASE}/api/ai/summarize-all`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ projects: projectsPayload }),
        })

        if (!response.ok) {
          console.warn('Failed to fetch AI summaries')
          return
        }

        const data = await response.json()
        const summariesMap: Record<string, string | null> = {}

        data.results?.forEach((result: any) => {
          if (result.name && result.summary) {
            summariesMap[result.name] = result.summary
          }
        })

        // Merge AI summaries into projects
        setProjects((prevProjects) =>
          prevProjects.map((p) => ({
            ...p,
            aiSummary: summariesMap[p.name] || null,
          }))
        )
      } catch (err) {
        // Silently fail - AI summaries are optional enhancement
        console.debug('AI summaries not available:', err)
      }
    }

    fetchAiSummaries()
  }, [projects.length]) // Only trigger when projects count changes

  useEffect(() => {
    fetchProjects()
    // Poll every 60 seconds
    const intervalId = setInterval(fetchProjects, 60_000)
    return () => clearInterval(intervalId)
  }, [fetchProjects])

  return {
    projects,
    loading,
    error,
    refetch: fetchProjects,
  }
}
