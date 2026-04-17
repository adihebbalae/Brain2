import { promises as fs } from 'node:fs'
import path from 'node:path'

export interface ReadingLogItem {
  title: string
  url: string
  read: boolean
  date?: string  // YYYY-MM-DD format
  tags: string[]
  source: 'reading-log'
}

/**
 * Parse a single line from ReadingLog.md
 * Supports:
 * - [ ] 2026-04-10 | [Title](https://url.com) | tag
 * - [x] 2026-04-10 | [Title](https://url.com) | optional-tag
 * - [ ] [Title](https://url.com)
 */
function parseReadingLogLine(line: string): ReadingLogItem | null {
  // Regex: - [x or space] optional-date | [title](url) optional-tag
  const regex = /^\s*-\s*\[([ x])\]\s*(?:(\d{4}-\d{2}-\d{2})\s*\|)?\s*\[([^\]]+)\]\(([^)]+)\)(?:\s*\|(.*))?/

  const match = line.match(regex)
  if (!match) return null

  const [, checkmark, date, title, url, tagsStr] = match

  const tags: string[] = []
  if (tagsStr) {
    // Split by comma and trim
    tags.push(...tagsStr.split(',').map(t => t.trim()).filter(t => t.length > 0))
  }

  return {
    title: title.trim(),
    url: url.trim(),
    read: checkmark === 'x',
    date: date || undefined,
    tags,
    source: 'reading-log',
  }
}

/**
 * Parse ReadingLog.md file and extract all reading items
 */
export async function parseReadingLog(vaultDir: string): Promise<ReadingLogItem[]> {
  const readingLogPath = path.join(vaultDir, 'Resources', 'ReadingLog.md')

  try {
    const content = await fs.readFile(readingLogPath, 'utf-8')
    const lines = content.split('\n')
    const items: ReadingLogItem[] = []

    for (const line of lines) {
      const item = parseReadingLogLine(line)
      if (item) {
        items.push(item)
      }
    }

    return items
  } catch (err) {
    // If file doesn't exist, create it
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
      await ensureReadingLogExists(vaultDir)
      return []
    }
    throw err
  }
}

/**
 * Ensure ReadingLog.md exists (create if missing)
 */
async function ensureReadingLogExists(vaultDir: string): Promise<void> {
  const readingLogPath = path.join(vaultDir, 'Resources', 'ReadingLog.md')
  const resourcesDir = path.join(vaultDir, 'Resources')

  try {
    await fs.access(readingLogPath)
  } catch {
    // Create Resources directory if needed
    try {
      await fs.mkdir(resourcesDir, { recursive: true })
    } catch {
      // Directory might already exist
    }

    // Create file with header comment
    const header = `# Reading List\n\n<!-- Format: - [ ] YYYY-MM-DD | [Title](url) | tag -->\n\n`
    await fs.writeFile(readingLogPath, header, 'utf-8')
    console.log(`Created ReadingLog.md at ${readingLogPath}`)
  }
}

/**
 * Append a new item to ReadingLog.md
 */
export async function appendToReadingLog(vaultDir: string, url: string, title?: string): Promise<void> {
  await ensureReadingLogExists(vaultDir)

  const readingLogPath = path.join(vaultDir, 'Resources', 'ReadingLog.md')

  // Default title to domain name if not provided
  const finalTitle = title || new URL(url).hostname

  // Format: - [ ] YYYY-MM-DD | [Title](url)
  const today = new Date().toISOString().split('T')[0]
  const entry = `- [ ] ${today} | [${finalTitle}](${url})\n`

  await fs.appendFile(readingLogPath, entry, 'utf-8')
}
