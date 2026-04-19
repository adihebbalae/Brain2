import { useState, useEffect } from 'react'

export interface ProjectActivity {
  name: string
  path: string
  lastCommitDate: string | null
  lastCommitMessage: string | null
  commitsLast30Days: number
  commitsLast90Days: number
}

export interface GitActivityData {
  heatmap: Record<string, number>
  projects: ProjectActivity[]
  totalCommitsLast30Days: number
  streak: number
}

export function useGitActivity() {
  const [data, setData] = useState<GitActivityData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchData = async () => {
    try {
      setLoading(true)
      setError(null)
      const response = await fetch('http://localhost:3001/api/git-activity')

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`)
      }

      const result = await response.json()
      setData(result)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch git activity')
      console.error('Failed to fetch git activity:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()

    // Poll every 60 seconds
    const interval = setInterval(fetchData, 60000)
    return () => clearInterval(interval)
  }, [])

  return { data, loading, error, refetch: fetchData }
}
