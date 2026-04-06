import { promises as fs } from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'

export interface DeadlineItem {
  id: string           // sha256(date + "|" + description) first 12 hex chars
  date: string         // ISO date string (YYYY-MM-DD)
  description: string
  tag: string | null   // school, project, personal, tutoring, poker — or null
  done: boolean
  urgency: 'red' | 'amber' | 'green' | 'gray'
  daysUntil: number    // negative = overdue, 0 = today
}

/**
 * Generate a stable ID for a deadline item
 */
function generateDeadlineId(date: string, description: string): string {
  const hash = crypto.createHash('sha256')
  hash.update(`${date}|${description}`)
  return hash.digest('hex').substring(0, 12)
}

/**
 * Calculate days between two dates
 * Uses local dates at midnight
 */
function calculateDaysUntil(dateStr: string): number {
  const [year, month, day] = dateStr.split('-').map(Number)
  const target = new Date(year, month - 1, day)

  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())

  const diffMs = target.getTime() - today.getTime()
  const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24))

  return diffDays
}

/**
 * Calculate urgency based on days until due date
 */
function calculateUrgency(daysUntil: number, done: boolean): 'red' | 'amber' | 'green' | 'gray' {
  if (done) return 'gray'
  if (daysUntil <= 2) return 'red'
  if (daysUntil <= 7) return 'amber'
  return 'green'
}

/**
 * Parse a single deadline line
 * Format: - [ ] YYYY-MM-DD | Description | optional-tag
 * or:     - [x] YYYY-MM-DD | Description | optional-tag
 */
function parseDeadlineLine(line: string): DeadlineItem | null {
  const trimmed = line.trim()

  // Skip comments and headers
  if (trimmed.startsWith('#') || trimmed.startsWith('>')) {
    return null
  }

  // Match checkbox pattern
  const checkboxMatch = trimmed.match(/^-\s*\[([ x])\]\s+(.+)$/)
  if (!checkboxMatch) {
    return null
  }

  const done = checkboxMatch[1] === 'x'
  const content = checkboxMatch[2]

  // Parse date | description | optional tag
  const parts = content.split('|').map(p => p.trim())
  if (parts.length < 2) {
    return null
  }

  const dateStr = parts[0]
  const description = parts[1]
  const tag = parts.length >= 3 && parts[2] ? parts[2] : null

  // Validate date format (YYYY-MM-DD)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    return null
  }

  // Validate date is parseable
  const dateObj = new Date(dateStr + 'T00:00:00')
  if (isNaN(dateObj.getTime())) {
    return null
  }

  const daysUntil = calculateDaysUntil(dateStr)
  const urgency = calculateUrgency(daysUntil, done)
  const id = generateDeadlineId(dateStr, description)

  return {
    id,
    date: dateStr,
    description,
    tag,
    done,
    urgency,
    daysUntil
  }
}

/**
 * Validate that a path is within the vault directory
 */
function validatePath(filePath: string, vaultDir: string): boolean {
  const resolved = path.resolve(filePath)
  const resolvedVault = path.resolve(vaultDir)

  // Ensure the file path is within or equal to the vault directory
  const relative = path.relative(resolvedVault, resolved)

  // If relative path starts with '..' or is absolute, it's outside
  return !relative.startsWith('..') && !path.isAbsolute(relative)
}

/**
 * Read and parse deadlines from deadlines.md
 */
export async function readDeadlines(vaultDir: string): Promise<DeadlineItem[]> {
  const deadlinesPath = path.join(vaultDir, 'Deadlines', 'deadlines.md')

  // Validate path security
  if (!validatePath(deadlinesPath, vaultDir)) {
    throw new Error('Invalid deadlines path')
  }

  // Return empty array if file doesn't exist (normal on first run)
  try {
    await fs.access(deadlinesPath)
  } catch {
    return []
  }

  // Read and parse file
  const content = await fs.readFile(deadlinesPath, 'utf-8')
  const lines = content.split('\n')

  const deadlines: DeadlineItem[] = []
  for (const line of lines) {
    const deadline = parseDeadlineLine(line)
    if (deadline) {
      deadlines.push(deadline)
    }
  }

  // Sort: non-done items by date ascending, done items at end by date descending
  const pending = deadlines.filter(d => !d.done).sort((a, b) => a.date.localeCompare(b.date))
  const completed = deadlines.filter(d => d.done).sort((a, b) => b.date.localeCompare(a.date))

  return [...pending, ...completed]
}
