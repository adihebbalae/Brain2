import { Router } from 'express'
import { getVelocityDataAsync, getWeeklyAverage, DailySnapshot } from '../lib/velocity-tracker.js'

const router = Router()

type TrendDirection = 'up' | 'down' | 'flat'

interface VelocityResponse {
  snapshots: DailySnapshot[]
  trend: {
    todosDirection: TrendDirection
    commitsDirection: TrendDirection
  }
}

/**
 * Calculate trend by comparing this week vs last week
 */
function calculateTrend(snapshots: DailySnapshot[]): VelocityResponse['trend'] {
  if (snapshots.length < 7) {
    return {
      todosDirection: 'flat',
      commitsDirection: 'flat',
    }
  }

  // Get date for 7 days ago
  const now = new Date()
  const sevenDaysAgo = new Date(now)
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
  const sevenDaysAgoStr = sevenDaysAgo.toISOString().substring(0, 10)

  const fourteenDaysAgo = new Date(now)
  fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14)
  const fourteenDaysAgoStr = fourteenDaysAgo.toISOString().substring(0, 10)

  // Split into this week and last week
  const thisWeek = snapshots.filter(s => s.date >= sevenDaysAgoStr)
  const lastWeek = snapshots.filter(s => s.date >= fourteenDaysAgoStr && s.date < sevenDaysAgoStr)

  // Calculate averages
  const thisWeekAvg = getWeeklyAverage(thisWeek)
  const lastWeekAvg = getWeeklyAverage(lastWeek)

  // Compare (with 10% threshold to avoid "flat" being too sensitive)
  const todosDiff = thisWeekAvg.todosPerWeek - lastWeekAvg.todosPerWeek
  const todosDirection: TrendDirection =
    Math.abs(todosDiff) < lastWeekAvg.todosPerWeek * 0.1 ? 'flat' :
    todosDiff > 0 ? 'up' : 'down'

  const commitsDiff = thisWeekAvg.commitsPerWeek - lastWeekAvg.commitsPerWeek
  const commitsDirection: TrendDirection =
    Math.abs(commitsDiff) < lastWeekAvg.commitsPerWeek * 0.1 ? 'flat' :
    commitsDiff > 0 ? 'up' : 'down'

  return {
    todosDirection,
    commitsDirection,
  }
}

router.get('/', async (_req, res) => {
  try {
    const snapshots = await getVelocityDataAsync(90)
    const trend = calculateTrend(snapshots)

    const response: VelocityResponse = {
      snapshots,
      trend,
    }

    return res.json(response)
  } catch (err) {
    console.error('[velocity] Failed to get velocity data:', err)
    return res.status(500).json({ error: 'Failed to get velocity data' })
  }
})

export { router as velocityRouter }
