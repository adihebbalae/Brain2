import { useEffect, useSyncExternalStore } from 'react'
import { Project } from '../types'

const API_BASE = 'http://localhost:3001'
const PROJECTS_CACHE_TTL_MS = 60_000

interface UseProjectsResult {
  projects: Project[]
  loading: boolean
  error: string | null
  refetch: () => void
}

interface ProjectsStoreState {
  projects: Project[]
  loading: boolean
  error: string | null
  initialized: boolean
  lastLoadedAt: number
}

const DEFAULT_STORE_STATE: ProjectsStoreState = {
  projects: [],
  loading: true,
  error: null,
  initialized: false,
  lastLoadedAt: 0,
}

let storeState: ProjectsStoreState = DEFAULT_STORE_STATE
const listeners = new Set<() => void>()
let projectsRequest: Promise<void> | null = null
let aiSummariesRequest: Promise<void> | null = null
let lastAiRefreshKey = ''

function getSnapshot(): ProjectsStoreState {
  return storeState
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

function publish(nextState: Partial<ProjectsStoreState>): void {
  storeState = { ...storeState, ...nextState }
  listeners.forEach(listener => listener())
}

function shouldUseCachedProjects(force: boolean): boolean {
  if (force || !storeState.initialized) {
    return false
  }

  return (Date.now() - storeState.lastLoadedAt) < PROJECTS_CACHE_TTL_MS
}

function buildAiRefreshKey(projects: Project[]): string {
  return projects.map(project => `${project.path}:${project.lastModified}`).join('|')
}

async function fetchAiSummaries(projects: Project[]): Promise<void> {
  const nextAiRefreshKey = buildAiRefreshKey(projects)
  if (!nextAiRefreshKey || nextAiRefreshKey === lastAiRefreshKey) {
    return
  }

  if (aiSummariesRequest) {
    return aiSummariesRequest
  }

  lastAiRefreshKey = nextAiRefreshKey
  const projectNames = projects.map(project => project.name)

  aiSummariesRequest = (async () => {
    try {
      const response = await fetch(`${API_BASE}/api/ai/summarize-all`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ projects: projectNames }),
      })

      if (!response.ok) {
        console.warn('Failed to fetch AI summaries')
        lastAiRefreshKey = ''
        return
      }

      const data = await response.json()
      const summariesMap: Record<string, { summary?: string; currentState?: string }> = {}

      data.results?.forEach((result: any) => {
        if (result.name) {
          summariesMap[result.name] = {
            summary: result.summary || undefined,
            currentState: result.currentState || undefined,
          }
        }
      })

      publish({
        projects: storeState.projects.map(project => ({
          ...project,
          summary: summariesMap[project.name]?.summary || project.summary,
          currentState: summariesMap[project.name]?.currentState || project.currentState,
        })),
      })
    } catch (err) {
      console.debug('AI project summaries not available:', err)
      lastAiRefreshKey = ''
    } finally {
      aiSummariesRequest = null
    }
  })()

  return aiSummariesRequest
}

async function fetchProjects(force = false): Promise<void> {
  if (projectsRequest) {
    return projectsRequest
  }

  if (shouldUseCachedProjects(force)) {
    return
  }

  publish({
    loading: storeState.projects.length === 0,
    error: null,
  })

  projectsRequest = (async () => {
    try {
      const response = await fetch(`${API_BASE}/api/projects`)

      if (!response.ok) {
        throw new Error(`Failed to fetch projects: ${response.statusText}`)
      }

      const data = await response.json()
      publish({
        projects: data,
        loading: false,
        error: null,
        initialized: true,
        lastLoadedAt: Date.now(),
      })

      void fetchAiSummaries(data)
    } catch (err) {
      publish({
        loading: false,
        error: err instanceof Error ? err.message : 'Failed to fetch projects',
        initialized: true,
      })
      console.error('Error fetching projects:', err)
    } finally {
      projectsRequest = null
    }
  })()

  return projectsRequest
}

export function resetProjectsStoreForTests(): void {
  storeState = { ...DEFAULT_STORE_STATE }
  projectsRequest = null
  aiSummariesRequest = null
  lastAiRefreshKey = ''
}

export function useProjects(): UseProjectsResult {
  const state = useSyncExternalStore(subscribe, getSnapshot, getSnapshot)

  useEffect(() => {
    if (!storeState.initialized || !shouldUseCachedProjects(false)) {
      void fetchProjects()
    }
  }, [])

  return {
    projects: state.projects,
    loading: state.loading,
    error: state.error,
    refetch: () => {
      void fetchProjects(true)
    },
  }
}
