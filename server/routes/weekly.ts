import { Router } from 'express'
import { promises as fs } from 'node:fs'
import path from 'node:path'
import { getPrimaryVaultDir, getVaultDirs } from '../lib/vault-config.js'
import { getOllamaStatus } from '../lib/ollama-client.js'
import { sendNotification } from '../lib/notifier.js'

const router = Router()

export interface WeeklyReviewResult {
  success: boolean
  path?: string
  error?: string
  preview?: string
}

export interface WeeklyReviewStatus {
  thisWeek: string
  generated: boolean
  path: string | null
}

/**
 * Get ISO week number and year (e.g., "2026-W16")
 */
function getISOWeek(date: Date = new Date()): string {
  const year = date.getFullYear()
  const jan4 = new Date(year, 0, 4)
  const msPerDay = 86400000
  const dayNum = Math.floor((date.getTime() - jan4.getTime()) / msPerDay)
  const weekNum = Math.floor((dayNum + jan4.getDay() + 1) / 7) + 1

  return `${year}-W${String(weekNum).padStart(2, '0')}`
}

/**
 * Gather git commits data for this week
 */
async function getGitCommitsThisWeek(): Promise<{ count: number; projects: string[] }> {
  try {
    const { getGitActivity } = await import('../lib/git-activity-parser.js')
    const projectsDir = process.env.PROJECTS_DIR
    if (!projectsDir) return { count: 0, projects: [] }

    const activity = await getGitActivity(projectsDir)

    const now = new Date()
    const sevenDaysAgo = new Date(now)
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
    const sevenDaysAgoStr = sevenDaysAgo.toISOString().substring(0, 10)

    let count = 0
    const projectSet = new Set<string>()

    for (const project of activity.projects) {
      if (project.lastCommitDate && project.lastCommitDate >= sevenDaysAgoStr) {
        count += project.commitsLast30Days
        projectSet.add(project.name)
      }
    }

    return { count, projects: Array.from(projectSet) }
  } catch {
    return { count: 0, projects: [] }
  }
}

/**
 * Scan all projects for completed TODOs this week
 */
async function getTodosClosedThisWeek(): Promise<string[]> {
  try {
    const { extractTodosMultiVault } = await import('../lib/todo-extractor.js')
    const projectsDir = process.env.PROJECTS_DIR || ''
    const vaultDirs = await getVaultDirs()

    const todosResult = await extractTodosMultiVault(projectsDir, vaultDirs)

    // Get all completed todos
    const completed: string[] = []
    for (const project in todosResult.byProject) {
      for (const todo of todosResult.byProject[project]) {
        if (todo.done) {
          completed.push(todo.text)
        }
      }
    }

    return completed.slice(0, 10) // Limit to top 10
  } catch {
    return []
  }
}

/**
 * Get articles saved this week
 */
async function getArticlesSavedThisWeek(): Promise<string[]> {
  try {
    const { parseReadingLog } = await import('../lib/reading-log-parser.js')
    const vaultDir = getPrimaryVaultDir()
    const items = await parseReadingLog(vaultDir)

    const now = new Date()
    const sevenDaysAgo = new Date(now)
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
    const sevenDaysAgoStr = sevenDaysAgo.toISOString().substring(0, 10)

    const thisWeek = items.filter(item => {
      if (!item.date) return false
      return item.date >= sevenDaysAgoStr
    })

    return thisWeek.map(item => item.title).slice(0, 5)
  } catch {
    return []
  }
}

/**
 * Get videos watched this week
 */
async function getVideosWatchedThisWeek(): Promise<string[]> {
  try {
    const { getYouTubeHistoryData } = await import('../lib/youtube-history-parser.js')
    const data = await getYouTubeHistoryData()

    if (!data.available) return []

    const now = new Date()
    const sevenDaysAgo = new Date(now)
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)

    const thisWeek = data.last30Days.filter(video => {
      const watchedDate = new Date(video.watchedAt)
      return watchedDate >= sevenDaysAgo
    })

    return thisWeek.map(v => v.title).slice(0, 5)
  } catch {
    return []
  }
}

/**
 * Get upcoming deadlines (next 14 days)
 */
async function getUpcomingDeadlines(): Promise<Array<{ date: string; description: string }>> {
  try {
    const { readDeadlinesMultiVault } = await import('../lib/deadline-reader.js')
    const vaultDirs = await getVaultDirs()
    const deadlines = await readDeadlinesMultiVault(vaultDirs)

    const now = new Date()
    const fourteenDaysLater = new Date(now)
    fourteenDaysLater.setDate(fourteenDaysLater.getDate() + 14)
    const fourteenDaysStr = fourteenDaysLater.toISOString().substring(0, 10)

    const upcoming = deadlines
      .filter(d => !d.done && d.date <= fourteenDaysStr)
      .slice(0, 5)

    return upcoming.map(d => ({ date: d.date, description: d.description }))
  } catch {
    return []
  }
}

/**
 * Get stale projects
 */
async function getStaleProjects(): Promise<string[]> {
  try {
    const { scanProjects } = await import('../lib/scanner.js')
    const projectsDir = process.env.PROJECTS_DIR
    if (!projectsDir) return []

    const projects = await scanProjects(projectsDir)
    const stale = projects.filter(p => p.staleDays >= 30)

    return stale.map(p => p.name).slice(0, 5)
  } catch {
    return []
  }
}

/**
 * Build the Ollama prompt for weekly review
 */
function buildWeeklyReviewPrompt(data: {
  date: string
  gitCommits: { count: number; projects: string[] }
  todosCompleted: string[]
  articlesSaved: string[]
  videosWatched: string[]
  upcomingDeadlines: Array<{ date: string; description: string }>
  staleProjects: string[]
}): string {
  const parts: string[] = []

  parts.push(`Generate a concise weekly review for a developer's personal dashboard. Today is ${data.date}.`)
  parts.push('')

  if (data.gitCommits.count > 0) {
    parts.push(`This week: ${data.gitCommits.count} git commits across projects: ${data.gitCommits.projects.join(', ')}.`)
  }

  if (data.todosCompleted.length > 0) {
    parts.push(`Todos closed: ${data.todosCompleted.slice(0, 5).join('; ')}.`)
  }

  if (data.articlesSaved.length > 0) {
    parts.push(`Articles saved: ${data.articlesSaved.join('; ')}.`)
  }

  if (data.videosWatched.length > 0) {
    parts.push(`Videos watched: ${data.videosWatched.join('; ')}.`)
  }

  if (data.upcomingDeadlines.length > 0) {
    const deadlineStr = data.upcomingDeadlines.map(d => `${d.description} on ${d.date}`).join('; ')
    parts.push(`Upcoming deadlines: ${deadlineStr}.`)
  }

  if (data.staleProjects.length > 0) {
    parts.push(`Stale projects needing attention: ${data.staleProjects.join(', ')}.`)
  }

  parts.push('')
  parts.push('Write a 200-word markdown weekly review. Include: what was accomplished, what to focus on next week, any concerning stale items. Be direct and actionable.')

  return parts.join('\n')
}

/**
 * Call Ollama to generate weekly review
 */
async function generateReviewWithOllama(prompt: string): Promise<string | null> {
  const status = await getOllamaStatus()
  if (!status.available) {
    return null
  }

  const OLLAMA_URL = process.env.OLLAMA_URL || 'http://localhost:11434'
  const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'llama3.1:8b'

  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 60000) // 60 second timeout

    const response = await fetch(`${OLLAMA_URL}/api/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: OLLAMA_MODEL,
        prompt,
        stream: false
      }),
      signal: controller.signal
    })

    clearTimeout(timeout)

    if (!response.ok) {
      return null
    }

    const data = await response.json()
    return data.response?.trim() || null
  } catch {
    return null
  }
}

/**
 * Save weekly review to vault
 */
async function saveWeeklyReview(week: string, content: string): Promise<string> {
  const vaultDir = getPrimaryVaultDir()
  const dailyNotesDir = path.join(vaultDir, 'DailyNotes')

  // Ensure DailyNotes directory exists
  try {
    await fs.mkdir(dailyNotesDir, { recursive: true })
  } catch (err) {
    console.error('Failed to create DailyNotes directory:', err)
  }

  const filename = `${week}-weekly-review.md`
  const filePath = path.join(dailyNotesDir, filename)

  await fs.writeFile(filePath, content, 'utf-8')

  return filePath
}

/**
 * Send ntfy notification with weekly review preview
 */
async function sendWeeklyReviewNotification(content: string): Promise<void> {
  const topic = process.env.NTFY_TOPIC
  if (!topic) return

  // Extract first 3 sentences
  const sentences = content.split(/[.!?]+/).filter(s => s.trim().length > 0)
  const preview = sentences.slice(0, 3).join('. ') + (sentences.length > 3 ? '...' : '.')

  await sendNotification(
    topic,
    preview,
    {
      title: '📋 Weekly Review Ready',
      priority: 'default',
      tags: ['clipboard']
    }
  )
}

/**
 * Generate and save weekly review
 */
async function generateWeeklyReview(): Promise<WeeklyReviewResult> {
  const week = getISOWeek()
  const today = new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })

  // Gather data
  const [gitCommits, todosCompleted, articlesSaved, videosWatched, upcomingDeadlines, staleProjects] = await Promise.all([
    getGitCommitsThisWeek(),
    getTodosClosedThisWeek(),
    getArticlesSavedThisWeek(),
    getVideosWatchedThisWeek(),
    getUpcomingDeadlines(),
    getStaleProjects()
  ])

  // Build prompt
  const prompt = buildWeeklyReviewPrompt({
    date: today,
    gitCommits,
    todosCompleted,
    articlesSaved,
    videosWatched,
    upcomingDeadlines,
    staleProjects
  })

  // Call Ollama
  const generatedContent = await generateReviewWithOllama(prompt)

  if (!generatedContent) {
    return {
      success: false,
      error: 'Ollama not available or failed to generate review'
    }
  }

  // Format the final content
  const finalContent = `# Weekly Review — ${week}\n\n${generatedContent}\n`

  // Save to vault
  const filePath = await saveWeeklyReview(week, finalContent)

  // Send notification (non-blocking)
  sendWeeklyReviewNotification(generatedContent).catch(err => {
    console.error('Failed to send weekly review notification:', err)
  })

  // Extract first 3 sentences for preview
  const sentences = generatedContent.split(/[.!?]+/).filter(s => s.trim().length > 0)
  const preview = sentences.slice(0, 3).join('. ') + (sentences.length > 3 ? '...' : '.')

  return {
    success: true,
    path: filePath,
    preview
  }
}

/**
 * POST /api/weekly-review
 * Generates and saves weekly review
 */
router.post('/weekly-review', async (_req, res) => {
  if (process.env.NODE_ENV === 'test') {
    // In test mode, don't send notifications
    return res.json({ success: true, path: '/mock/path', preview: 'Test preview' })
  }

  try {
    const result = await generateWeeklyReview()
    return res.json(result)
  } catch (err) {
    console.error('Failed to generate weekly review:', err)
    return res.status(500).json({ success: false, error: 'Failed to generate weekly review' })
  }
})

/**
 * GET /api/weekly-review/status
 * Returns status of this week's review
 */
router.get('/weekly-review/status', async (_req, res) => {
  try {
    const week = getISOWeek()
    const vaultDir = getPrimaryVaultDir()
    const filename = `${week}-weekly-review.md`
    const filePath = path.join(vaultDir, 'DailyNotes', filename)

    let generated = false
    try {
      await fs.access(filePath)
      generated = true
    } catch {
      generated = false
    }

    const status: WeeklyReviewStatus = {
      thisWeek: week,
      generated,
      path: generated ? filePath : null
    }

    return res.json(status)
  } catch (err) {
    console.error('Failed to get weekly review status:', err)
    return res.status(500).json({ error: 'Failed to get weekly review status' })
  }
})

/**
 * Auto-trigger weekly review on Sunday (exported for server startup)
 */
export async function autoTriggerWeeklyReview(): Promise<void> {
  const now = new Date()

  // Check if today is Sunday (0 = Sunday)
  if (now.getDay() !== 0) return

  // Check if review already exists
  try {
    const week = getISOWeek()
    const vaultDir = getPrimaryVaultDir()
    const filename = `${week}-weekly-review.md`
    const filePath = path.join(vaultDir, 'DailyNotes', filename)

    await fs.access(filePath)
    // File exists, skip
    return
  } catch {
    // File doesn't exist, generate it
  }

  console.log('[weekly-review] Sunday detected, auto-generating weekly review...')

  try {
    const result = await generateWeeklyReview()
    if (result.success) {
      console.log(`[weekly-review] Auto-generated weekly review saved to: ${result.path}`)
    } else {
      console.error(`[weekly-review] Auto-generation failed: ${result.error}`)
    }
  } catch (err) {
    console.error('[weekly-review] Auto-generation error:', err)
  }
}

export { router as weeklyRouter }
