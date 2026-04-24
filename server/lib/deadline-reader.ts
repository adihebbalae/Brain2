import { promises as fs } from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'

export interface DeadlineItem {
  id: string           // sha256(date + "|" + description) first 12 hex chars
  date: string         // ISO date string (YYYY-MM-DD)
  description: string
  tag: string | null   // school, project, personal, tutoring, poker — or null
  notes?: string       // optional free-text notes (4th pipe field)
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

  // Parse date | description | optional tag | optional notes
  const parts = content.split('|').map(p => p.trim())
  if (parts.length < 2) {
    return null
  }

  const dateStr = parts[0]
  const description = parts[1]
  const tag = parts.length >= 3 && parts[2] ? parts[2] : null
  const notes = parts.length >= 4 && parts[3] ? parts[3] : undefined

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
    notes,
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

/**
 * Append a new deadline to the primary vault's deadlines.md
 */
function buildDeadlineLine(
  done: boolean,
  date: string,
  description: string,
  tag: string | null,
  notes: string | null
): string {
  const checkbox = done ? '[x]' : '[ ]'
  if (notes) {
    return `- ${checkbox} ${date} | ${description} | ${tag ?? ''} | ${notes}`
  }
  if (tag) {
    return `- ${checkbox} ${date} | ${description} | ${tag}`
  }
  return `- ${checkbox} ${date} | ${description}`
}

export async function addDeadline(
  vaultDir: string,
  { date, description, tag, notes }: { date: string; description: string; tag?: string | null; notes?: string | null }
): Promise<DeadlineItem> {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error('Invalid date format')
  if (!validatePath(path.join(vaultDir, 'Deadlines', 'deadlines.md'), vaultDir)) {
    throw new Error('Invalid vault path')
  }

  const cleanDesc = description.trim().replace(/\|/g, '-')
  const cleanTag = tag ? tag.trim().replace(/\|/g, '-') : null
  const cleanNotes = notes ? notes.trim().replace(/\|/g, '-') : null
  const line = buildDeadlineLine(false, date, cleanDesc, cleanTag, cleanNotes)

  const deadlinesPath = path.join(vaultDir, 'Deadlines', 'deadlines.md')
  await fs.mkdir(path.dirname(deadlinesPath), { recursive: true })
  try {
    await fs.access(deadlinesPath)
  } catch {
    await fs.writeFile(deadlinesPath, '# Deadlines\n\n', 'utf-8')
  }
  await fs.appendFile(deadlinesPath, `${line}\n`, 'utf-8')

  const daysUntil = calculateDaysUntil(date)
  return {
    id: generateDeadlineId(date, cleanDesc),
    date,
    description: cleanDesc,
    tag: cleanTag,
    notes: cleanNotes ?? undefined,
    done: false,
    urgency: calculateUrgency(daysUntil, false),
    daysUntil,
  }
}

/**
 * Remove a deadline by ID from the first vault dir that contains it.
 * Returns true if found and removed, false otherwise.
 */
export async function removeDeadline(vaultDirs: string[], id: string): Promise<boolean> {
  for (const vaultDir of vaultDirs) {
    const deadlinesPath = path.join(vaultDir, 'Deadlines', 'deadlines.md')
    if (!validatePath(deadlinesPath, vaultDir)) continue
    try {
      const content = await fs.readFile(deadlinesPath, 'utf-8')
      const lines = content.split('\n')
      let found = false
      const newLines = lines.filter(line => {
        const parsed = parseDeadlineLine(line)
        if (parsed && parsed.id === id) { found = true; return false }
        return true
      })
      if (found) {
        await fs.writeFile(deadlinesPath, newLines.join('\n'), 'utf-8')
        return true
      }
    } catch {
      // file may not exist in this vault — continue
    }
  }
  return false
}

/**
 * Update an existing deadline in the first vault dir that contains it.
 * Finds the line by old ID, replaces it with the new values.
 * Returns the updated DeadlineItem (with possibly a new ID if date/description changed),
 * or null if not found.
 */
export async function updateDeadline(
  vaultDirs: string[],
  id: string,
  updates: {
    date?: string
    description?: string
    tag?: string | null
    notes?: string | null
    done?: boolean
  }
): Promise<DeadlineItem | null> {
  for (const vaultDir of vaultDirs) {
    const deadlinesPath = path.join(vaultDir, 'Deadlines', 'deadlines.md')
    if (!validatePath(deadlinesPath, vaultDir)) continue
    try {
      const content = await fs.readFile(deadlinesPath, 'utf-8')
      const lines = content.split('\n')
      let updatedItem: DeadlineItem | null = null

      const newLines = lines.map(line => {
        const parsed = parseDeadlineLine(line)
        if (!parsed || parsed.id !== id) return line

        const newDate = updates.date ?? parsed.date
        const newDesc = updates.description !== undefined
          ? updates.description.trim().replace(/\|/g, '-')
          : parsed.description
        const newTag = updates.tag !== undefined
          ? (updates.tag ? updates.tag.trim().replace(/\|/g, '-') : null)
          : parsed.tag
        const newNotes = updates.notes !== undefined
          ? (updates.notes ? updates.notes.trim().replace(/\|/g, '-') : null)
          : (parsed.notes ?? null)
        const newDone = updates.done !== undefined ? updates.done : parsed.done

        const daysUntil = calculateDaysUntil(newDate)
        updatedItem = {
          id: generateDeadlineId(newDate, newDesc),
          date: newDate,
          description: newDesc,
          tag: newTag,
          notes: newNotes ?? undefined,
          done: newDone,
          urgency: calculateUrgency(daysUntil, newDone),
          daysUntil,
        }

        return buildDeadlineLine(newDone, newDate, newDesc, newTag, newNotes)
      })

      if (updatedItem) {
        await fs.writeFile(deadlinesPath, newLines.join('\n'), 'utf-8')
        return updatedItem
      }
    } catch {
      // file may not exist in this vault — continue
    }
  }
  return null
}

/**
 * Read and merge deadlines from deadlines.md in multiple vault directories.
 * Deduplicates by ID (same date + description = same ID).
 */
export async function readDeadlinesMultiVault(vaultDirs: string[]): Promise<DeadlineItem[]> {
  const seenIds = new Set<string>()
  const allDeadlines: DeadlineItem[] = []

  for (const dir of vaultDirs) {
    try {
      const items = await readDeadlines(dir)
      for (const item of items) {
        if (!seenIds.has(item.id)) {
          seenIds.add(item.id)
          allDeadlines.push(item)
        }
      }
    } catch (error) {
      console.warn(`[deadline-reader] Failed to read deadlines from ${dir}:`, error)
    }
  }

  // Re-sort merged results
  const pending = allDeadlines.filter(d => !d.done).sort((a, b) => a.date.localeCompare(b.date))
  const completed = allDeadlines.filter(d => d.done).sort((a, b) => b.date.localeCompare(a.date))

  return [...pending, ...completed]
}
