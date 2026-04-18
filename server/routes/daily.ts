import { Router } from 'express'
import { promises as fs } from 'node:fs'
import path from 'node:path'
import { readDeadlinesMultiVault } from '../lib/deadline-reader.js'
import { scanProjects } from '../lib/scanner.js'
import { getVaultDirs, getPrimaryVaultDir } from '../lib/vault-config.js'
import type { DeadlineItem } from '../lib/deadline-reader.js'
import type { ProjectState } from '../lib/state-reader.js'

const router = Router()

export interface CalendarEvent {
  id: string
  title: string
  start: string
  end: string
}

export interface RandomNote {
  title: string
  path: string
  preview: string
}

export interface GitActivitySummary {
  commitsToday: number
  commitsThisWeek: number
}

export interface DailyContext {
  date: string
  deadlines: DeadlineItem[]
  calendarEvents: CalendarEvent[]
  staleProjects: ProjectState[]
  randomNotes: RandomNote[]
  gitActivity: GitActivitySummary
}

/**
 * Get today's date formatted as "Wednesday, April 16, 2026"
 */
function getTodayFormatted(): string {
  const now = new Date()
  const options: Intl.DateTimeFormatOptions = {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  }
  return now.toLocaleDateString('en-US', options)
}

/**
 * Get today + next 3 days deadlines
 */
async function getTodayDeadlines(): Promise<DeadlineItem[]> {
  const vaultDirs = await getVaultDirs()
  const allDeadlines = await readDeadlinesMultiVault(vaultDirs)

  const now = new Date()
  const threeDaysLater = new Date(now)
  threeDaysLater.setDate(threeDaysLater.getDate() + 3)
  const threeDaysStr = threeDaysLater.toISOString().substring(0, 10)

  // Filter: not done and within next 3 days
  return allDeadlines.filter(d => !d.done && d.date <= threeDaysStr)
}

/**
 * Get calendar events if available
 */
async function getCalendarEvents(): Promise<CalendarEvent[]> {
  try {
    // Import dynamically to avoid errors if calendar module not set up
    const { getCalendarEvents: getEvents } = await import('../lib/calendar-client.js')

    const events = await getEvents()
    return events.map(e => ({
      id: e.id,
      title: e.title,
      start: e.start,
      end: e.end
    }))
  } catch {
    // Calendar not configured or failed
    return []
  }
}

/**
 * Get top 3 stalest projects
 */
async function getStaleProjects(): Promise<ProjectState[]> {
  const projectsDir = process.env.PROJECTS_DIR
  if (!projectsDir) return []

  const projects = await scanProjects(projectsDir)

  // Sort by staleDays descending and take top 3
  const sorted = [...projects].sort((a, b) => b.staleDays - a.staleDays)
  return sorted.slice(0, 3)
}

/**
 * Get 3 random vault notes for resurfacing
 */
async function getRandomNotes(): Promise<RandomNote[]> {
  const vaultDir = getPrimaryVaultDir()
  const vaultDirs = await getVaultDirs()

  // Collect all .md files from all vaults, excluding DailyNotes
  const allNotes: string[] = []

  for (const dir of vaultDirs) {
    try {
      await collectMarkdownFiles(dir, dir, allNotes)
    } catch (err) {
      console.warn(`Failed to scan vault ${dir}:`, err)
    }
  }

  // Filter out DailyNotes and small files
  const filtered: RandomNote[] = []

  for (const notePath of allNotes) {
    // Skip if in DailyNotes
    if (notePath.includes('DailyNotes')) continue

    try {
      const content = await fs.readFile(notePath, 'utf-8')
      if (content.length < 100) continue

      const title = path.basename(notePath, '.md')
      const preview = content.substring(0, 150).trim()
      const relativePath = path.relative(vaultDir, notePath)

      filtered.push({ title, path: relativePath, preview })
    } catch {
      // Skip files we can't read
    }
  }

  // Shuffle and take 3
  const shuffled = shuffle(filtered)
  return shuffled.slice(0, 3)
}

/**
 * Recursively collect markdown files
 */
async function collectMarkdownFiles(dir: string, rootDir: string, result: string[]): Promise<void> {
  try {
    const entries = await fs.readdir(dir, { withFileTypes: true })

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name)

      if (entry.isDirectory()) {
        // Skip hidden dirs and node_modules
        if (entry.name.startsWith('.') || entry.name === 'node_modules') continue
        await collectMarkdownFiles(fullPath, rootDir, result)
      } else if (entry.isFile() && entry.name.endsWith('.md')) {
        result.push(fullPath)
      }
    }
  } catch (err) {
    // Skip directories we can't read
  }
}

/**
 * Shuffle array using Fisher-Yates algorithm
 */
function shuffle<T>(array: T[]): T[] {
  const shuffled = [...array]
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
  }
  return shuffled
}

/**
 * Get git activity if available
 */
async function getGitActivitySummary(): Promise<GitActivitySummary> {
  try {
    const { getGitActivity } = await import('../lib/git-activity-parser.js')
    const projectsDir = process.env.PROJECTS_DIR
    if (!projectsDir) return { commitsToday: 0, commitsThisWeek: 0 }

    const activity = await getGitActivity(projectsDir)

    const today = new Date().toISOString().substring(0, 10)
    const commitsToday = activity.heatmap[today] || 0

    // Count commits in last 7 days
    const now = new Date()
    let commitsThisWeek = 0
    for (let i = 0; i < 7; i++) {
      const date = new Date(now)
      date.setDate(date.getDate() - i)
      const dateStr = date.toISOString().substring(0, 10)
      commitsThisWeek += activity.heatmap[dateStr] || 0
    }

    return { commitsToday, commitsThisWeek }
  } catch {
    // Git activity not available
    return { commitsToday: 0, commitsThisWeek: 0 }
  }
}

/**
 * GET /api/daily-context
 * Assembles today's context from all available sources
 */
router.get('/daily-context', async (_req, res) => {
  try {
    const [date, deadlines, calendarEvents, staleProjects, randomNotes, gitActivity] = await Promise.all([
      getTodayFormatted(),
      getTodayDeadlines(),
      getCalendarEvents(),
      getStaleProjects(),
      getRandomNotes(),
      getGitActivitySummary()
    ])

    const context: DailyContext = {
      date,
      deadlines,
      calendarEvents,
      staleProjects,
      randomNotes,
      gitActivity
    }

    return res.json(context)
  } catch (err) {
    console.error('Failed to get daily context:', err)
    return res.status(500).json({ error: 'Failed to get daily context' })
  }
})

export { router as dailyRouter }
