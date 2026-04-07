import { promises as fs } from 'node:fs'
import path from 'node:path'

export interface NotificationState {
  lastDeadlineNotify: Record<string, string>  // deadlineId → ISO date last notified
  lastStaleNotify: Record<string, string>     // projectName → ISO date last notified
  lastDigestDate: string                       // ISO date of last digest (YYYY-MM-DD or "")
}

function emptyState(): NotificationState {
  return {
    lastDeadlineNotify: {},
    lastStaleNotify: {},
    lastDigestDate: '',
  }
}

function statePath(vaultDir: string): string {
  return path.join(vaultDir, '.cortex-notify-state.json')
}

export async function loadNotificationState(vaultDir: string): Promise<NotificationState> {
  const filePath = statePath(vaultDir)
  try {
    const content = await fs.readFile(filePath, 'utf-8')
    const parsed = JSON.parse(content) as Partial<NotificationState>
    return {
      lastDeadlineNotify: parsed.lastDeadlineNotify ?? {},
      lastStaleNotify: parsed.lastStaleNotify ?? {},
      lastDigestDate: parsed.lastDigestDate ?? '',
    }
  } catch {
    // File missing or invalid — first run
    return emptyState()
  }
}

export async function saveNotificationState(
  vaultDir: string,
  state: NotificationState
): Promise<void> {
  const filePath = statePath(vaultDir)
  try {
    await fs.writeFile(filePath, JSON.stringify(state, null, 2), 'utf-8')
  } catch (error) {
    console.error('[notification-state] Failed to save state:', error)
  }
}

/**
 * Returns today's date as YYYY-MM-DD in local time.
 */
export function todayString(): string {
  const now = new Date()
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

/**
 * Returns true if the given key was already notified today.
 * @param storedDate - The ISO date stored in state for this key (or undefined).
 */
export function wasNotifiedToday(storedDate: string | undefined): boolean {
  if (!storedDate) return false
  return storedDate === todayString()
}

/**
 * Returns true if the given key was notified within the last N days.
 */
export function wasNotifiedWithinDays(storedDate: string | undefined, days: number): boolean {
  if (!storedDate) return false
  const stored = new Date(storedDate + 'T00:00:00')
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const diffMs = today.getTime() - stored.getTime()
  const diffDays = diffMs / (1000 * 60 * 60 * 24)
  return diffDays < days
}
