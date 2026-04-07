import { readDeadlines } from './deadline-reader.js'
import { scanProjects } from './scanner.js'
import { extractTodos } from './todo-extractor.js'
import { sendNotification } from './notifier.js'
import {
  loadNotificationState,
  saveNotificationState,
  todayString,
  wasNotifiedToday,
  wasNotifiedWithinDays,
} from './notification-state.js'

const CHECK_INTERVAL_MS = 60 * 60 * 1000  // 60 minutes
const STARTUP_DELAY_MS = 5_000

/**
 * Parses NTFY_DIGEST_TIME (HH:MM) and returns [hour, minute].
 * Defaults to [8, 0].
 */
function parseDigestTime(raw: string | undefined): [number, number] {
  if (!raw) return [8, 0]
  const match = raw.match(/^(\d{1,2}):(\d{2})$/)
  if (!match) return [8, 0]
  return [parseInt(match[1], 10), parseInt(match[2], 10)]
}

/**
 * Returns true if now is within 5 minutes of the target [hour, minute].
 */
function isWithinDigestWindow(hour: number, minute: number): boolean {
  const now = new Date()
  const nowMinutes = now.getHours() * 60 + now.getMinutes()
  const targetMinutes = hour * 60 + minute
  return Math.abs(nowMinutes - targetMinutes) <= 5
}

async function runChecks(): Promise<void> {
  const topic = process.env.NTFY_TOPIC
  if (!topic) return  // Silently skip when not configured

  const vaultDir = process.env.VAULT_DIR
  const projectsDir = process.env.PROJECTS_DIR
  if (!vaultDir || !projectsDir) return

  const state = await loadNotificationState(vaultDir)
  let stateChanged = false

  // --- 1. Red deadline check ---
  try {
    const deadlines = await readDeadlines(vaultDir)
    for (const deadline of deadlines) {
      if (deadline.urgency !== 'red' || deadline.done) continue
      if (wasNotifiedToday(state.lastDeadlineNotify[deadline.id])) continue

      await sendNotification(
        topic,
        `🔴 Deadline due soon: ${deadline.description} on ${deadline.date}`,
        { priority: 'high', tags: ['warning', 'calendar'] }
      )
      state.lastDeadlineNotify[deadline.id] = todayString()
      stateChanged = true
    }
  } catch (error) {
    console.error('[notification-service] Red deadline check failed:', error)
  }

  // --- 2. Stale project check ---
  try {
    const projects = await scanProjects(projectsDir)
    for (const project of projects) {
      if (project.staleDays < 30) continue
      if (wasNotifiedWithinDays(state.lastStaleNotify[project.name], 7)) continue

      await sendNotification(
        topic,
        `⚠️ Stale project: ${project.name} hasn't been updated in ${project.staleDays} days`,
        { priority: 'default', tags: ['warning'] }
      )
      state.lastStaleNotify[project.name] = todayString()
      stateChanged = true
    }
  } catch (error) {
    console.error('[notification-service] Stale project check failed:', error)
  }

  // --- 3. Daily digest ---
  try {
    const [digestHour, digestMinute] = parseDigestTime(process.env.NTFY_DIGEST_TIME)
    if (isWithinDigestWindow(digestHour, digestMinute) && !wasNotifiedToday(state.lastDigestDate)) {
      const [deadlines, todosResult] = await Promise.all([
        readDeadlines(vaultDir),
        extractTodos(projectsDir, vaultDir),
      ])

      const openCount = todosResult.total - todosResult.completed
      const upcomingDeadlines = deadlines.filter(d => !d.done).slice(0, 3)
      const deadlineCount = deadlines.filter(d => !d.done).length

      let message = `📋 Cortex Daily Digest\n${openCount} open TODOs • ${deadlineCount} upcoming deadlines`
      if (upcomingDeadlines.length > 0) {
        const next = upcomingDeadlines[0]
        message += `\nNext: ${next.description} on ${next.date}`
      }

      await sendNotification(topic, message, {
        priority: 'default',
        tags: ['spiral_notepad'],
      })
      state.lastDigestDate = todayString()
      stateChanged = true
    }
  } catch (error) {
    console.error('[notification-service] Daily digest failed:', error)
  }

  if (stateChanged) {
    await saveNotificationState(vaultDir, state)
  }
}

/**
 * Starts the background notification service.
 * Runs once after a short delay, then every 60 minutes.
 * Must not be called in test environments.
 */
export function startNotificationService(): void {
  if (process.env.NODE_ENV === 'test') return

  // Initial run after 5-second delay
  setTimeout(() => {
    void runChecks()
    setInterval(() => void runChecks(), CHECK_INTERVAL_MS)
  }, STARTUP_DELAY_MS)
}
