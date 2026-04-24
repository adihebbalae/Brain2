import { useEffect, useState } from 'react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from 'recharts'

interface DailySnapshot {
  date: string
  todosOpen: number
  todosClosed: number
  commitsToday: number
}

type TrendDirection = 'up' | 'down' | 'flat'

interface VelocityData {
  snapshots: DailySnapshot[]
  trend: {
    todosDirection: TrendDirection
    commitsDirection: TrendDirection
  }
}

interface ChartData {
  date: string
  todos: number
  commits: number
}

export function VelocityPanel() {
  const [data, setData] = useState<VelocityData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchVelocity()
  }, [])

  const fetchVelocity = async () => {
    try {
      setLoading(true)
      const response = await fetch('http://localhost:3001/api/velocity')
      if (!response.ok) {
        throw new Error('Failed to fetch velocity data')
      }
      const velocityData = await response.json()
      setData(velocityData)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h2 className="text-xl font-semibold mb-4">Velocity Tracking</h2>
        <div className="h-64 bg-gray-200 rounded animate-pulse" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-white rounded-lg border border-red-200 p-6">
        <h2 className="text-xl font-semibold mb-4 text-red-700">Error Loading Velocity</h2>
        <p className="text-red-600 mb-4">{error}</p>
        <button
          onClick={fetchVelocity}
          className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition-colors"
        >
          Retry
        </button>
      </div>
    )
  }

  if (!data || data.snapshots.length === 0) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h2 className="text-xl font-semibold mb-4">Velocity Tracking</h2>
        <p className="text-gray-500 text-center py-8">
          📊 No velocity data yet. Data will be collected daily.
        </p>
      </div>
    )
  }

  // Prepare chart data (last 30 days for readability)
  const recentSnapshots = data.snapshots.slice(-30)
  const chartData: ChartData[] = recentSnapshots.map(s => ({
    date: s.date.substring(5), // Show MM-DD only
    todos: s.todosClosed,
    commits: s.commitsToday,
  }))

  // Trend arrows
  const getTrendIcon = (direction: TrendDirection) => {
    switch (direction) {
      case 'up': return '↑'
      case 'down': return '↓'
      case 'flat': return '→'
    }
  }

  const getTrendColor = (direction: TrendDirection) => {
    switch (direction) {
      case 'up': return 'text-green-600'
      case 'down': return 'text-red-600'
      case 'flat': return 'text-gray-600'
    }
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6">
      <div className="flex justify-between items-start mb-4">
        <h2 className="text-xl font-semibold">Velocity Tracking</h2>
        <div className="flex gap-4 text-sm">
          <div className={`flex items-center gap-1 ${getTrendColor(data.trend.todosDirection)}`}>
            <span className="text-xs text-gray-500">TODOs:</span>
            <span className="font-semibold">{getTrendIcon(data.trend.todosDirection)}</span>
          </div>
          <div className={`flex items-center gap-1 ${getTrendColor(data.trend.commitsDirection)}`}>
            <span className="text-xs text-gray-500">Commits:</span>
            <span className="font-semibold">{getTrendIcon(data.trend.commitsDirection)}</span>
          </div>
        </div>
      </div>

      <ResponsiveContainer width="100%" height={240}>
        <BarChart data={chartData}>
          <XAxis
            dataKey="date"
            tick={{ fontSize: 10 }}
            interval="preserveStartEnd"
          />
          <YAxis tick={{ fontSize: 12 }} />
          <Tooltip
            contentStyle={{
              backgroundColor: 'white',
              border: '1px solid #e5e7eb',
              borderRadius: '0.375rem',
              fontSize: '0.875rem',
            }}
          />
          <Legend
            wrapperStyle={{ fontSize: '0.875rem' }}
          />
          <Bar
            dataKey="todos"
            fill="#10b981"
            name="TODOs Closed"
            radius={[4, 4, 0, 0]}
          />
          <Bar
            dataKey="commits"
            fill="#3b82f6"
            name="Commits"
            radius={[4, 4, 0, 0]}
          />
        </BarChart>
      </ResponsiveContainer>

      <div className="mt-4 pt-4 border-t border-gray-200 text-xs text-gray-500">
        Showing last {recentSnapshots.length} days of activity
      </div>
    </div>
  )
}
