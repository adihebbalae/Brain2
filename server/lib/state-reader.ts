import { promises as fs } from 'node:fs'
import path from 'node:path'

export interface ProjectState {
  name: string
  path: string
  stateFile: string
  summaryFile?: string | null
  currentStateFile?: string | null
  status: 'in_progress' | 'blocked' | 'completed' | 'not_started' | 'stale'
  lastModified: string
  summary: string
  currentState?: string
  nextSteps: string[]
  staleDays: number
}

const SUMMARY_FILE_PRIORITY = [
  'README.md',
  '_dev/README.md',
  '_dev/summary.md',
  '_dev/project-summary.md',
  'docs/README.md',
  'docs/summary.md',
]

const STATE_FILE_PRIORITY = [
  '.agents/state.md',
  '.agents/state.json',
  'agent_state.md',
  'Agent_State.json',
  'state.md',
  'Status.md',
]

function validatePath(resolvedPath: string, baseDir: string): boolean {
  const normalizedBase = path.normalize(baseDir)
  const normalizedPath = path.normalize(resolvedPath)
  return normalizedPath.startsWith(normalizedBase + path.sep) || normalizedPath === normalizedBase
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, ' ').trim()
}

function cleanText(value: string, maxLength = 280): string {
  const normalized = normalizeWhitespace(
    value
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
      .replace(/`([^`]+)`/g, '$1')
      .replace(/\*\*([^*]+)\*\*/g, '$1')
      .replace(/\*([^*]+)\*/g, '$1')
      .replace(/~~([^~]+)~~/g, '$1')
      .replace(/^[-*]\s+/gm, '')
      .replace(/^\d+\.\s+/gm, '')
  )

  if (normalized.length <= maxLength) {
    return normalized
  }

  return normalized.slice(0, maxLength).trimEnd() + '...'
}

function stripFrontmatter(content: string): string {
  return content.replace(/^---\s*\r?\n[\s\S]*?\r?\n---\s*/u, '')
}

function stripCodeBlocks(content: string): string {
  return content.replace(/```[\s\S]*?```/g, '\n')
}

function getSection(content: string, headings: string[]): string | null {
  const pattern = headings.map(escapeRegExp).join('|')
  const regex = new RegExp(
    `##\\s+(?:${pattern})\\s*\\r?\\n([\\s\\S]*?)(?=\\r?\\n##\\s+|$)`,
    'i'
  )
  const match = content.match(regex)
  if (!match) {
    return null
  }

  const section = cleanText(match[1])
  return section || null
}

function getMeaningfulParagraphs(content: string): string[] {
  const cleaned = stripCodeBlocks(stripFrontmatter(content))
    .replace(/\r/g, '')
    .replace(/^>\s?/gm, '')

  return cleaned
    .split(/\n\s*\n/)
    .map(paragraph => cleanText(paragraph, 500))
    .filter(paragraph => {
      if (paragraph.length < 30) {
        return false
      }

      if (/^(#|[-*]|\d+\.)\s/.test(paragraph)) {
        return false
      }

      if (/^(npm|pnpm|yarn|bun|git|cd|npx)\s/i.test(paragraph)) {
        return false
      }

      return true
    })
}

function parseJsonObject(content: string): Record<string, any> | null {
  try {
    const parsed = JSON.parse(content)
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as Record<string, any>
    }
  } catch {
    // Ignore invalid JSON
  }

  return null
}

function getLatestChangelogEntry(parsed: Record<string, any>): string | null {
  const changelog = parsed.changelog
  if (!Array.isArray(changelog) || changelog.length === 0) {
    return null
  }

  const latest = changelog[changelog.length - 1]
  if (typeof latest === 'string') {
    return cleanText(latest)
  }

  if (latest && typeof latest === 'object') {
    const candidate = latest.description ?? latest.task ?? latest.title ?? latest.date
    if (typeof candidate === 'string') {
      return cleanText(candidate)
    }
  }

  return null
}

function extractJsonOverview(parsed: Record<string, any>): string {
  const projectDescription = parsed.project?.description
  if (typeof projectDescription === 'string' && projectDescription.trim()) {
    return cleanText(projectDescription)
  }

  if (typeof parsed.project_brief === 'string' && parsed.project_brief.trim()) {
    return cleanText(parsed.project_brief)
  }

  const decisions = parsed.context?.recent_decisions
  if (Array.isArray(decisions) && decisions.length > 0) {
    return cleanText(decisions.slice(0, 2).join('. '))
  }

  const latest = getLatestChangelogEntry(parsed)
  if (latest) {
    return latest
  }

  return ''
}

function extractJsonCurrentState(parsed: Record<string, any>): string {
  const parts: string[] = []

  const currentTask = parsed.current_task
  if (currentTask && typeof currentTask === 'object') {
    if (typeof currentTask.title === 'string' && currentTask.title.trim()) {
      const taskStatus =
        typeof currentTask.status === 'string' && currentTask.status.trim()
          ? ` (${currentTask.status})`
          : ''
      parts.push(`Current task: ${cleanText(currentTask.title, 180)}${taskStatus}`)
    }
  }

  if (typeof parsed.context?.blocked_on === 'string' && parsed.context.blocked_on.trim()) {
    parts.push(`Blocked on: ${cleanText(parsed.context.blocked_on, 180)}`)
  }

  const latest = getLatestChangelogEntry(parsed)
  if (latest) {
    parts.push(`Latest update: ${latest}`)
  }

  if (parts.length > 0) {
    return cleanText(parts.join('. '), 320)
  }

  return extractJsonOverview(parsed)
}

function extractJsonNextSteps(parsed: Record<string, any>): string[] {
  const nextSteps = new Set<string>()

  const currentTask = parsed.current_task
  if (currentTask && typeof currentTask === 'object') {
    const task = currentTask as Record<string, any>
    if (typeof task.title === 'string' && task.title.trim()) {
      const status = String(task.status || '').toLowerCase()
      if (!['done', 'completed', 'complete'].includes(status)) {
        nextSteps.add(cleanText(task.title, 180))
      }
    }
  }

  const tasks = parsed.tasks
  if (tasks && typeof tasks === 'object') {
    for (const value of Object.values(tasks)) {
      if (!value || typeof value !== 'object') {
        continue
      }

      const v = value as Record<string, any>
      const title = typeof v.title === 'string' ? v.title : null
      const status = String(v.status || '').toLowerCase()
      if (!title || !title.trim()) {
        continue
      }

      if (['done', 'completed', 'complete'].includes(status)) {
        continue
      }

      nextSteps.add(cleanText(title, 180))
      if (nextSteps.size >= 5) {
        break
      }
    }
  }

  return Array.from(nextSteps).slice(0, 5)
}

function extractSummary(content: string, sourceFile: string | null): string {
  const fileExtension = sourceFile ? path.extname(sourceFile).toLowerCase() : ''
  if (fileExtension === '.json') {
    const parsed = parseJsonObject(content)
    if (parsed) {
      return extractJsonOverview(parsed)
    }
  }

  const section = getSection(content, ['Summary', 'Overview', 'About', 'Purpose'])
  if (section) {
    return section
  }

  const paragraphs = getMeaningfulParagraphs(content)
  if (paragraphs.length > 0) {
    return cleanText(paragraphs[0], 320)
  }

  return cleanText(content, 320)
}

function extractCurrentState(content: string, sourceFile: string | null): string {
  if (!content.trim()) {
    return ''
  }

  const fileExtension = sourceFile ? path.extname(sourceFile).toLowerCase() : ''
  if (fileExtension === '.json') {
    const parsed = parseJsonObject(content)
    if (parsed) {
      return extractJsonCurrentState(parsed)
    }
  }

  const section = getSection(content, [
    'Current State',
    'Status',
    'Progress',
    'Where I Left Off',
    'Latest Update',
    'Blockers',
  ])
  if (section) {
    return section
  }

  const paragraphs = getMeaningfulParagraphs(content)
  if (paragraphs.length > 0) {
    return cleanText(paragraphs[0], 320)
  }

  return cleanText(content, 320)
}

function extractNextSteps(content: string, sourceFile: string | null): string[] {
  const fileExtension = sourceFile ? path.extname(sourceFile).toLowerCase() : ''
  if (fileExtension === '.json') {
    const parsed = parseJsonObject(content)
    if (parsed) {
      return extractJsonNextSteps(parsed)
    }
  }

  const nextStepsMatch = content.match(/##\s+Next Steps\s*\r?\n([\s\S]*?)(?=\r?\n##\s+|$)/i)
  if (nextStepsMatch) {
    const bullets = nextStepsMatch[1].match(/^[-*]\s+(.+)$/gm)
    if (bullets) {
      return bullets.map(bullet => cleanText(bullet.replace(/^[-*]\s+/, ''), 180)).slice(0, 5)
    }
  }

  const todoMatch = content.match(/##\s+TODO\s*\r?\n([\s\S]*?)(?=\r?\n##\s+|$)/i)
  if (todoMatch) {
    const bullets = todoMatch[1].match(/^[-*]\s+(.+)$/gm)
    if (bullets) {
      return bullets.map(bullet => cleanText(bullet.replace(/^[-*]\s+/, ''), 180)).slice(0, 5)
    }
  }

  return content
    .split('\n')
    .slice(-50)
    .filter(line => line.match(/^[-*]\s+\[\s\]/))
    .map(line => cleanText(line.replace(/^[-*]\s+\[\s\]\s*/, ''), 180))
    .slice(0, 5)
}

function extractFrontmatterStatus(content: string): ProjectState['status'] | undefined {
  const frontmatterMatch = content.match(/^---\s*\r?\n([\s\S]*?)\r?\n---/)
  if (!frontmatterMatch) {
    return undefined
  }

  const statusMatch = frontmatterMatch[1].match(/status:\s*['"]?([^'">\n]+)['"]?/i)
  if (!statusMatch) {
    return undefined
  }

  const statusValue = statusMatch[1].trim().toLowerCase()
  if (['in_progress', 'blocked', 'completed', 'not_started', 'stale'].includes(statusValue)) {
    return statusValue as ProjectState['status']
  }

  return undefined
}

function inferStatus(content: string, staleDays: number, sourceFile: string | null): ProjectState['status'] {
  const fileExtension = sourceFile ? path.extname(sourceFile).toLowerCase() : ''
  if (fileExtension === '.json') {
    const parsed = parseJsonObject(content)
    if (parsed) {
      const currentTaskStatus = String(
        parsed.current_task?.status ?? parsed.current_task?.state ?? parsed.status ?? ''
      )
        .trim()
        .toLowerCase()

      if (['done', 'completed', 'complete', 'shipped'].includes(currentTaskStatus)) {
        return 'completed'
      }

      if (
        ['blocked', 'waiting', 'waiting_on', 'stuck'].includes(currentTaskStatus) ||
        typeof parsed.context?.blocked_on === 'string'
      ) {
        return 'blocked'
      }

      if (['not_started', 'planned', 'todo', 'idea'].includes(currentTaskStatus)) {
        return 'not_started'
      }

      if (['in_progress', 'active', 'working'].includes(currentTaskStatus)) {
        return 'in_progress'
      }
    }
  }

  const lowerContent = content.toLowerCase()

  if (
    lowerContent.includes('completed') ||
    lowerContent.includes('shipped') ||
    lowerContent.includes('done') ||
    lowerContent.includes('finished')
  ) {
    return 'completed'
  }

  if (
    lowerContent.includes('blocked') ||
    lowerContent.includes('waiting on') ||
    lowerContent.includes('stuck')
  ) {
    return 'blocked'
  }

  if (
    lowerContent.includes('not started') ||
    lowerContent.includes('idea') ||
    lowerContent.includes('concept') ||
    lowerContent.includes('todo')
  ) {
    return 'not_started'
  }

  if (staleDays > 14) {
    return 'stale'
  }

  return 'in_progress'
}

function calculateStaleDays(lastModified: Date): number {
  const now = new Date()
  const diffMs = now.getTime() - lastModified.getTime()
  return Math.floor(diffMs / (1000 * 60 * 60 * 24))
}

async function findProjectFile(
  projectPath: string,
  baseDir: string,
  priorities: string[]
): Promise<string | null> {
  for (const relativeFilePath of priorities) {
    const filePath = path.join(projectPath, relativeFilePath)
    const resolvedPath = path.resolve(filePath)

    if (!validatePath(resolvedPath, baseDir)) {
      continue
    }

    try {
      await fs.access(filePath)
      return relativeFilePath
    } catch {
      continue
    }
  }

  return null
}

function buildJsonOverviewBrief(parsed: Record<string, any>): string {
  const lines: string[] = []

  const name = parsed.project?.name
  if (typeof name === 'string' && name.trim()) {
    lines.push(`Name: ${cleanText(name, 100)}`)
  }

  const desc = parsed.project?.description ?? parsed.project_brief
  if (typeof desc === 'string' && desc.trim()) {
    lines.push(`Description: ${cleanText(desc, 500)}`)
  }

  const techStack = parsed.project?.tech_stack
  if (Array.isArray(techStack) && techStack.length > 0) {
    lines.push(`Tech stack: ${(techStack as unknown[]).slice(0, 8).join(', ')}`)
  }

  const archDecisions = parsed.project?.architecture_decisions
  if (archDecisions && typeof archDecisions === 'object' && !Array.isArray(archDecisions)) {
    const keyDecisions = Object.entries(archDecisions as Record<string, unknown>)
      .slice(0, 3)
      .map(([k, v]) => `${k}: ${cleanText(String(v), 120)}`)
    if (keyDecisions.length > 0) {
      lines.push(`Key decisions: ${keyDecisions.join('; ')}`)
    }
  }

  const extDeps = parsed.project?.external_dependencies
  if (Array.isArray(extDeps) && extDeps.length > 0) {
    lines.push(`External integrations: ${(extDeps as unknown[]).slice(0, 4).join(', ')}`)
  }

  return lines.join('\n')
}

function buildJsonStateBrief(parsed: Record<string, any>): string {
  const lines: string[] = []

  const currentTask = parsed.current_task
  if (currentTask && typeof currentTask === 'object') {
    const ct = currentTask as Record<string, any>
    if (typeof ct.title === 'string' && ct.title.trim()) {
      const taskStatus = typeof ct.status === 'string' && ct.status.trim() ? ` (${ct.status})` : ''
      lines.push(`Current task: ${cleanText(ct.title, 200)}${taskStatus}`)
    }
  }

  const blockedOn = parsed.context?.blocked_on
  if (typeof blockedOn === 'string' && blockedOn.trim()) {
    lines.push(`Blocked on: ${cleanText(blockedOn, 200)}`)
  }

  const tasks = parsed.tasks
  if (tasks && typeof tasks === 'object') {
    const activeTasks = Object.entries(tasks as Record<string, unknown>)
      .filter(([, v]) => {
        if (!v || typeof v !== 'object') return false
        const t = v as Record<string, any>
        const s = String(t.status || '').toLowerCase()
        return !['done', 'completed', 'complete', 'shipped'].includes(s)
      })
      .slice(0, 3)
      .map(([id, v]) => {
        const t = v as Record<string, any>
        return `${id}: ${cleanText(String(t.title || ''), 120)}`
      })
    if (activeTasks.length > 0) {
      lines.push(`Active tasks: ${activeTasks.join('; ')}`)
    }
  }

  const latest = getLatestChangelogEntry(parsed)
  if (latest) {
    lines.push(`Latest update: ${latest}`)
  }

  const recentDecisions = parsed.context?.recent_decisions
  if (Array.isArray(recentDecisions) && recentDecisions.length > 0) {
    const decisions = (recentDecisions as unknown[])
      .slice(-2)
      .map(d => cleanText(String(d), 120))
    lines.push(`Recent decisions: ${decisions.join('; ')}`)
  }

  if (typeof parsed.mode === 'string' && parsed.mode.trim()) {
    lines.push(`Mode: ${parsed.mode}`)
  }

  return lines.join('\n')
}

function buildMarkdownOverviewBrief(content: string): string {
  const lines: string[] = []
  const cleaned = stripFrontmatter(content)

  const titleMatch = cleaned.match(/^#\s+(.+)$/m)
  if (titleMatch) {
    lines.push(`Name: ${cleanText(titleMatch[1], 100)}`)
  }

  const section = getSection(cleaned, ['Summary', 'Overview', 'About', 'Purpose', 'Description'])
  if (section) {
    lines.push(`Description: ${cleanText(section, 500)}`)
  } else {
    const paragraphs = getMeaningfulParagraphs(cleaned)
    if (paragraphs.length > 0) {
      lines.push(`Description: ${cleanText(paragraphs[0], 500)}`)
      if (paragraphs.length > 1) {
        lines.push(`More context: ${cleanText(paragraphs[1], 300)}`)
      }
    }
  }

  const featuresSection = getSection(cleaned, ['Features', 'What it does', 'Capabilities'])
  if (featuresSection) {
    lines.push(`Features: ${cleanText(featuresSection, 300)}`)
  }

  return lines.join('\n')
}

function buildMarkdownStateBrief(content: string): string {
  const lines: string[] = []

  const frontmatterStatus = extractFrontmatterStatus(content)
  if (frontmatterStatus) {
    lines.push(`Status: ${frontmatterStatus}`)
  }

  const stateSection = getSection(content, [
    'Current State', 'Status', 'Progress', 'Where I Left Off', 'Latest Update',
  ])
  if (stateSection) {
    lines.push(`Current focus: ${cleanText(stateSection, 400)}`)
  }

  const blockersSection = getSection(content, ['Blockers', 'Blocked', 'Blocking'])
  if (blockersSection) {
    lines.push(`Blockers: ${cleanText(blockersSection, 200)}`)
  }

  const nextSteps = extractNextSteps(content, null)
  if (nextSteps.length > 0) {
    lines.push(`Next steps: ${nextSteps.slice(0, 3).join('; ')}`)
  }

  if (lines.length === 0) {
    const paragraphs = getMeaningfulParagraphs(stripFrontmatter(content))
    if (paragraphs.length > 0) {
      lines.push(`Content: ${cleanText(paragraphs[0], 500)}`)
      if (paragraphs.length > 1) {
        lines.push(`More context: ${cleanText(paragraphs[1], 300)}`)
      }
    }
  }

  return lines.join('\n')
}

export function prepareContentForAi(
  content: string,
  sourceFile: string | null,
  purpose: 'overview' | 'current_state'
): string {
  if (!content.trim()) {
    return ''
  }

  const fileExtension = sourceFile ? path.extname(sourceFile).toLowerCase() : ''

  if (fileExtension === '.json') {
    const parsed = parseJsonObject(content)
    if (!parsed) {
      return cleanText(content, 1500)
    }
    return purpose === 'overview' ? buildJsonOverviewBrief(parsed) : buildJsonStateBrief(parsed)
  }

  return purpose === 'overview'
    ? buildMarkdownOverviewBrief(content)
    : buildMarkdownStateBrief(content)
}

export async function readProjectState(
  projectPath: string,
  baseDir: string
): Promise<ProjectState | null> {
  const resolvedProjectPath = path.resolve(projectPath)
  if (!validatePath(resolvedProjectPath, baseDir)) {
    throw new Error(`Invalid project path: ${projectPath}`)
  }

  const [summaryFile, currentStateFile] = await Promise.all([
    findProjectFile(projectPath, baseDir, SUMMARY_FILE_PRIORITY),
    findProjectFile(projectPath, baseDir, STATE_FILE_PRIORITY),
  ])

  const primaryFile = currentStateFile ?? summaryFile
  if (!primaryFile) {
    return null
  }

  const filesToRead = Array.from(new Set([primaryFile, summaryFile, currentStateFile].filter(Boolean) as string[]))
  const fileEntries = await Promise.all(
    filesToRead.map(async relativeFilePath => {
      const absoluteFilePath = path.join(projectPath, relativeFilePath)
      const [content, stats] = await Promise.all([
        fs.readFile(absoluteFilePath, 'utf-8'),
        fs.stat(absoluteFilePath),
      ])

      return [relativeFilePath, { content, stats }] as const
    })
  )

  const fileMap = new Map(fileEntries)
  const primaryEntry = fileMap.get(primaryFile)
  if (!primaryEntry) {
    return null
  }

  const summaryContent = summaryFile
    ? fileMap.get(summaryFile)?.content ?? ''
    : primaryEntry.content
  const stateContent = currentStateFile
    ? fileMap.get(currentStateFile)?.content ?? ''
    : ''

  const lastModified = primaryEntry.stats.mtime
  const staleDays = calculateStaleDays(lastModified)

  const statusSourceContent = stateContent || summaryContent
  const statusSourceFile = currentStateFile ?? summaryFile ?? primaryFile
  const frontmatterStatus =
    path.extname(statusSourceFile ?? '').toLowerCase() === '.md'
      ? extractFrontmatterStatus(statusSourceContent)
      : undefined
  const status = frontmatterStatus ?? inferStatus(statusSourceContent, staleDays, statusSourceFile)

  return {
    name: path.basename(projectPath),
    path: projectPath,
    stateFile: primaryFile,
    summaryFile,
    currentStateFile,
    status,
    lastModified: lastModified.toISOString(),
    summary: extractSummary(summaryContent, summaryFile ?? primaryFile),
    currentState: currentStateFile ? extractCurrentState(stateContent, currentStateFile) : '',
    nextSteps: currentStateFile ? extractNextSteps(stateContent, currentStateFile) : [],
    staleDays,
  }
}
