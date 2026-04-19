import { promises as fs, statSync } from 'node:fs'
import { execSync } from 'node:child_process'
import path from 'node:path'

export interface CommitEntry {
  project: string
  date: string        // ISO date "2026-04-16"
  subject: string     // commit message
  hash: string
}

export interface ProjectActivity {
  name: string
  path: string            // Full absolute path to project
  lastCommitDate: string | null
  lastCommitMessage: string | null
  commitsLast30Days: number
  commitsLast90Days: number
}

export interface GitActivityData {
  heatmap: Record<string, number>
  projects: ProjectActivity[]
  totalCommitsLast30Days: number
  streak: number
}

/**
 * Parses git log output and returns commit entries
 * @param output - Raw git log output in format "%H|%ai|%s"
 * @param projectName - Name of the project
 * @returns Array of CommitEntry objects
 */
function parseGitLog(output: string, projectName: string): CommitEntry[] {
  const lines = output.trim().split('\n').filter(line => line.length > 0)
  const commits: CommitEntry[] = []

  for (const line of lines) {
    // Split on | but need to handle | in commit message
    const firstPipe = line.indexOf('|')
    const secondPipe = line.indexOf('|', firstPipe + 1)

    if (firstPipe === -1 || secondPipe === -1) {
      continue // Skip malformed lines
    }

    const hash = line.substring(0, firstPipe)
    const dateTimeStr = line.substring(firstPipe + 1, secondPipe)
    const subject = line.substring(secondPipe + 1)

    // Extract just the date (first 10 chars: YYYY-MM-DD)
    const date = dateTimeStr.substring(0, 10)

    commits.push({
      project: projectName,
      date,
      subject,
      hash
    })
  }

  return commits
}

/**
 * Runs git log for a single project directory
 * @param projectDir - Absolute path to project directory
 * @returns Object with project path and commit entries, or empty array if git fails
 */
function getProjectCommits(projectDir: string): { path: string, commits: CommitEntry[] } {
  const projectName = path.basename(projectDir)

  // Check if .git directory exists
  const gitDir = path.join(projectDir, '.git')
  try {
    const stats = statSync(gitDir)
    if (!stats.isDirectory()) {
      return { path: projectDir, commits: [] }
    }
  } catch {
    return { path: projectDir, commits: [] } // No .git directory
  }

  // Run git log
  try {
    const output = execSync(
      `git -C "${projectDir}" log --since=90.days.ago --format="%H|%ai|%s"`,
      {
        encoding: 'utf-8',
        timeout: 5000, // 5 second timeout
        stdio: ['pipe', 'pipe', 'pipe'] // Suppress stderr
      }
    )

    const commits = parseGitLog(output, projectName)
    return { path: projectDir, commits }
  } catch (error) {
    // Git command failed (corrupted repo, not a git repo, etc.)
    console.warn(`Failed to get git log for ${projectName}:`, error instanceof Error ? error.message : String(error))
    return { path: projectDir, commits: [] }
  }
}

/**
 * Builds heatmap data from commit entries
 * @param commits - Array of all commit entries
 * @returns Object mapping date strings to commit counts
 */
function buildHeatmap(commits: CommitEntry[]): Record<string, number> {
  const heatmap: Record<string, number> = {}

  for (const commit of commits) {
    if (!heatmap[commit.date]) {
      heatmap[commit.date] = 0
    }
    heatmap[commit.date]++
  }

  return heatmap
}

/**
 * Calculates current streak (consecutive days with at least 1 commit)
 * @param heatmap - Date to commit count mapping
 * @returns Number of consecutive days ending today (or yesterday)
 */
function calculateStreak(heatmap: Record<string, number>): number {
  const today = new Date()
  let streak = 0
  let checkDate = new Date(today)

  // If no commits today, start from yesterday
  const todayStr = today.toISOString().substring(0, 10)
  if (!heatmap[todayStr] || heatmap[todayStr] === 0) {
    checkDate.setDate(checkDate.getDate() - 1)
  }

  // Count backwards
  while (true) {
    const dateStr = checkDate.toISOString().substring(0, 10)
    if (heatmap[dateStr] && heatmap[dateStr] > 0) {
      streak++
      checkDate.setDate(checkDate.getDate() - 1)
    } else {
      break
    }
  }

  return streak
}

/**
 * Builds per-project activity summary
 * @param commits - Array of all commit entries
 * @param projectName - Name of the project
 * @param projectPath - Full path to the project
 * @returns ProjectActivity object
 */
function buildProjectActivity(commits: CommitEntry[], projectName: string, projectPath: string): ProjectActivity {
  const projectCommits = commits.filter(c => c.project === projectName)

  if (projectCommits.length === 0) {
    return {
      name: projectName,
      path: projectPath,
      lastCommitDate: null,
      lastCommitMessage: null,
      commitsLast30Days: 0,
      commitsLast90Days: 0
    }
  }

  // Sort by date descending to get latest commit
  projectCommits.sort((a, b) => b.date.localeCompare(a.date))

  const now = new Date()
  const thirtyDaysAgo = new Date(now)
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
  const thirtyDaysAgoStr = thirtyDaysAgo.toISOString().substring(0, 10)

  const commitsLast30Days = projectCommits.filter(c => c.date >= thirtyDaysAgoStr).length
  const commitsLast90Days = projectCommits.length

  return {
    name: projectName,
    path: projectPath,
    lastCommitDate: projectCommits[0].date,
    lastCommitMessage: projectCommits[0].subject,
    commitsLast30Days,
    commitsLast90Days
  }
}

/**
 * Scans all projects and aggregates git activity
 * @param projectsDir - Base directory containing all projects
 * @returns GitActivityData with heatmap, project summaries, totals, and streak
 */
export async function getGitActivity(projectsDir: string): Promise<GitActivityData> {
  const resolvedDir = path.resolve(projectsDir)

  // Read all immediate subdirectories
  let entries
  try {
    entries = await fs.readdir(resolvedDir, { withFileTypes: true })
  } catch (error) {
    console.error(`Failed to read projects directory: ${projectsDir}`, error)
    return {
      heatmap: {},
      projects: [],
      totalCommitsLast30Days: 0,
      streak: 0
    }
  }

  // Filter for directories, skip hidden ones
  const directories = entries
    .filter(entry => entry.isDirectory() && !entry.name.startsWith('.'))
    .map(entry => path.join(resolvedDir, entry.name))

  // Get commits for all projects
  const allCommits: CommitEntry[] = []
  const projectData: { name: string, path: string }[] = []

  for (const dir of directories) {
    const result = getProjectCommits(dir)
    allCommits.push(...result.commits)
    projectData.push({ name: path.basename(dir), path: result.path })
  }

  // Build heatmap
  const heatmap = buildHeatmap(allCommits)

  // Build per-project activity
  const projects = projectData.map(({ name, path: projectPath }) =>
    buildProjectActivity(allCommits, name, projectPath)
  )

  // Sort projects: with commits first (by last commit date desc), then no git repo
  projects.sort((a, b) => {
    if (a.lastCommitDate && !b.lastCommitDate) return -1
    if (!a.lastCommitDate && b.lastCommitDate) return 1
    if (!a.lastCommitDate && !b.lastCommitDate) return 0
    return b.lastCommitDate!.localeCompare(a.lastCommitDate!)
  })

  // Calculate totals
  const now = new Date()
  const thirtyDaysAgo = new Date(now)
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
  const thirtyDaysAgoStr = thirtyDaysAgo.toISOString().substring(0, 10)

  const totalCommitsLast30Days = allCommits.filter(c => c.date >= thirtyDaysAgoStr).length

  // Calculate streak
  const streak = calculateStreak(heatmap)

  return {
    heatmap,
    projects,
    totalCommitsLast30Days,
    streak
  }
}
