import { promises as fs } from 'node:fs'
import path from 'node:path'

export interface ProjectState {
  name: string
  path: string
  stateFile: string
  status: 'in_progress' | 'blocked' | 'completed' | 'not_started' | 'stale'
  lastModified: string  // ISO string
  summary: string
  nextSteps: string[]
  staleDays: number
}

// Priority order for state file detection
const STATE_FILE_PRIORITY = [
  'agent_state.md',
  'Agent_State.json',
  'state.md',
  'Status.md',
  'README.md',
]

/**
 * Validates that a resolved path is inside the base directory
 * Prevents path traversal attacks
 */
function validatePath(resolvedPath: string, baseDir: string): boolean {
  const normalizedBase = path.normalize(baseDir)
  const normalizedPath = path.normalize(resolvedPath)
  return normalizedPath.startsWith(normalizedBase + path.sep) || normalizedPath === normalizedBase
}

/**
 * Finds the first existing state file in the project directory
 */
async function findStateFile(projectPath: string, baseDir: string): Promise<string | null> {
  for (const filename of STATE_FILE_PRIORITY) {
    const filePath = path.join(projectPath, filename)
    const resolvedPath = path.resolve(filePath)

    // Security: validate path is inside base directory
    if (!validatePath(resolvedPath, baseDir)) {
      continue
    }

    try {
      await fs.access(filePath)
      return filename
    } catch {
      // File doesn't exist, try next
      continue
    }
  }
  return null
}

/**
 * Extracts summary from markdown content
 */
function extractSummary(content: string): string {
  // Try ## Summary or ## Overview section
  const summaryMatch = content.match(/##\s+(Summary|Overview)\s*\n([\s\S]*?)(?=\n##|$)/i)
  if (summaryMatch) {
    const section = summaryMatch[2].trim()
    const sentences = section.split(/[.!?]\s+/).slice(0, 3).join('. ')
    return sentences || section.substring(0, 200)
  }

  // Try ## Status section
  const statusMatch = content.match(/##\s+Status\s*\n([\s\S]*?)(?=\n##|$)/i)
  if (statusMatch) {
    const section = statusMatch[1].trim()
    return section.substring(0, 200)
  }

  // Last 2-3 non-empty lines
  const lines = content.split('\n').filter(line => line.trim().length > 0)
  if (lines.length > 0) {
    const lastLines = lines.slice(-3).join(' ')
    return lastLines.substring(0, 200)
  }

  // First 200 characters
  return content.substring(0, 200).trim()
}

/**
 * Extracts next steps from markdown content
 */
function extractNextSteps(content: string): string[] {
  // Try ## Next Steps section
  const nextStepsMatch = content.match(/##\s+Next Steps\s*\n([\s\S]*?)(?=\n##|$)/i)
  if (nextStepsMatch) {
    const section = nextStepsMatch[1]
    const bullets = section.match(/^[-*]\s+(.+)$/gm)
    if (bullets) {
      return bullets.map(b => b.replace(/^[-*]\s+/, '').trim()).slice(0, 5)
    }
  }

  // Try ## TODO section
  const todoMatch = content.match(/##\s+TODO\s*\n([\s\S]*?)(?=\n##|$)/i)
  if (todoMatch) {
    const section = todoMatch[1]
    const bullets = section.match(/^[-*]\s+(.+)$/gm)
    if (bullets) {
      return bullets.map(b => b.replace(/^[-*]\s+/, '').trim()).slice(0, 5)
    }
  }

  // Look for - [ ] items in last 50 lines
  const lines = content.split('\n').slice(-50)
  const uncheckedItems = lines
    .filter(line => line.match(/^[-*]\s+\[\s\]/))
    .map(line => line.replace(/^[-*]\s+\[\s\]\s*/, '').trim())
    .slice(0, 5)

  return uncheckedItems
}

/**
 * Infers status from content keywords
 */
function inferStatus(content: string, staleDays: number): ProjectState['status'] {
  const lowerContent = content.toLowerCase()

  // Check for completed indicators
  if (lowerContent.includes('completed') ||
      lowerContent.includes('shipped') ||
      lowerContent.includes('done') ||
      lowerContent.includes('finished')) {
    return 'completed'
  }

  // Check for blocked indicators
  if (lowerContent.includes('blocked') ||
      lowerContent.includes('waiting on') ||
      lowerContent.includes('stuck')) {
    return 'blocked'
  }

  // Check for not started indicators
  if (lowerContent.includes('not started') ||
      lowerContent.includes('idea') ||
      lowerContent.includes('concept') ||
      lowerContent.includes('todo')) {
    return 'not_started'
  }

  // Check if stale (> 14 days old)
  if (staleDays > 14) {
    return 'stale'
  }

  return 'in_progress'
}

/**
 * Calculates days since file was last modified
 */
function calculateStaleDays(lastModified: Date): number {
  const now = new Date()
  const diffMs = now.getTime() - lastModified.getTime()
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))
  return diffDays
}

/**
 * Reads and parses a project's state file
 */
export async function readProjectState(
  projectPath: string,
  baseDir: string
): Promise<ProjectState | null> {
  // Security: validate project path is inside base directory
  const resolvedProjectPath = path.resolve(projectPath)
  if (!validatePath(resolvedProjectPath, baseDir)) {
    throw new Error(`Invalid project path: ${projectPath}`)
  }

  // Find state file
  const stateFile = await findStateFile(projectPath, baseDir)
  if (!stateFile) {
    return null
  }

  const stateFilePath = path.join(projectPath, stateFile)

  // Read file content and stats
  const [content, stats] = await Promise.all([
    fs.readFile(stateFilePath, 'utf-8'),
    fs.stat(stateFilePath)
  ])

  const lastModified = stats.mtime
  const staleDays = calculateStaleDays(lastModified)

  // Extract frontmatter status if present
  let status: ProjectState['status'] | undefined
  const frontmatterMatch = content.match(/^---\s*\n([\s\S]*?)\n---/)
  if (frontmatterMatch) {
    const frontmatter = frontmatterMatch[1]
    const statusMatch = frontmatter.match(/status:\s*['"]?([^'">\n]+)['"]?/i)
    if (statusMatch) {
      const statusValue = statusMatch[1].trim().toLowerCase()
      if (['in_progress', 'blocked', 'completed', 'not_started', 'stale'].includes(statusValue)) {
        status = statusValue as ProjectState['status']
      }
    }
  }

  // Infer status from content if not in frontmatter
  if (!status) {
    status = inferStatus(content, staleDays)
  }

  const projectName = path.basename(projectPath)
  const summary = extractSummary(content)
  const nextSteps = extractNextSteps(content)

  return {
    name: projectName,
    path: projectPath,
    stateFile,
    status,
    lastModified: lastModified.toISOString(),
    summary,
    nextSteps,
    staleDays
  }
}
