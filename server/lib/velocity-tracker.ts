import { promises as fs } from 'node:fs'
import path from 'node:path'
import simpleGit from 'simple-git'
import { extractTodosMultiVault } from './todo-extractor.js'
import { getPrimaryVaultDir, getVaultDirs } from './vault-config.js'

export interface DailySnapshot {
  date: string        // YYYY-MM-DD
  todosOpen: number
  todosClosed: number
  commitsToday: number
}

interface VelocityData {
  snapshots: DailySnapshot[]
}

/**
 * Get the path to the velocity tracking file
 */
function getVelocityFilePath(): string {
  const vaultDir = getPrimaryVaultDir()
  return path.join(vaultDir, '.cortex-velocity.json')
}

/**
 * Read existing velocity data from disk
 */
async function readVelocityData(): Promise<VelocityData> {
  const filePath = getVelocityFilePath()

  try {
    const content = await fs.readFile(filePath, 'utf-8')
    const data = JSON.parse(content)
    return data
  } catch (error) {
    // File doesn't exist yet or is invalid - return empty data
    return { snapshots: [] }
  }
}

/**
 * Write velocity data to disk
 */
async function writeVelocityData(data: VelocityData): Promise<void> {
  const filePath = getVelocityFilePath()
  await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf-8')
}

/**
 * Count today's commits across all projects using simple-git
 */
async function countTodayCommits(projectsDir: string): Promise<number> {
  const resolvedDir = path.resolve(projectsDir)

  // Read all immediate subdirectories
  let entries
  try {
    entries = await fs.readdir(resolvedDir, { withFileTypes: true })
  } catch (error) {
    console.error(`[velocity-tracker] Failed to read projects directory: ${projectsDir}`, error)
    return 0
  }

  // Filter for directories, skip hidden ones
  const directories = entries
    .filter(entry => entry.isDirectory() && !entry.name.startsWith('.'))
    .map(entry => path.join(resolvedDir, entry.name))

  const today = new Date()
  const todayStr = today.toISOString().substring(0, 10)

  let totalCommits = 0

  // For each project directory, count today's commits
  for (const dir of directories) {
    const gitDir = path.join(dir, '.git')

    // Check if .git exists
    try {
      const stat = await fs.stat(gitDir)
      if (!stat.isDirectory()) continue
    } catch {
      continue // No .git directory
    }

    try {
      const git = simpleGit(dir)

      // Get commits from today (midnight to now)
      const log = await git.log({
        '--since': `${todayStr} 00:00:00`,
        '--until': `${todayStr} 23:59:59`,
      })

      totalCommits += log.all.length
    } catch (error) {
      console.warn(`[velocity-tracker] Failed to get git log for ${path.basename(dir)}:`, error instanceof Error ? error.message : String(error))
    }
  }

  return totalCommits
}

/**
 * Record a daily snapshot of todos and commits
 * Deduplicates by date (if today already exists, update it)
 */
export async function recordDailySnapshot(): Promise<DailySnapshot> {
  const { PROJECTS_DIR } = process.env
  if (!PROJECTS_DIR) {
    throw new Error('PROJECTS_DIR environment variable is required')
  }

  const today = new Date()
  const todayStr = today.toISOString().substring(0, 10)

  // Count todos
  const vaultDirs = await getVaultDirs()
  const todosResult = await extractTodosMultiVault(PROJECTS_DIR, vaultDirs)
  const todosOpen = todosResult.total - todosResult.completed
  const todosClosed = todosResult.completed

  // Count commits
  const commitsToday = await countTodayCommits(PROJECTS_DIR)

  const snapshot: DailySnapshot = {
    date: todayStr,
    todosOpen,
    todosClosed,
    commitsToday,
  }

  // Read existing data
  const data = await readVelocityData()

  // Remove any existing entry for today (deduplicate)
  data.snapshots = data.snapshots.filter(s => s.date !== todayStr)

  // Append new snapshot
  data.snapshots.push(snapshot)

  // Sort by date ascending
  data.snapshots.sort((a, b) => a.date.localeCompare(b.date))

  // Write back to disk
  await writeVelocityData(data)

  console.log(`[velocity-tracker] Recorded snapshot for ${todayStr}: ${todosOpen} open, ${todosClosed} closed, ${commitsToday} commits`)

  return snapshot
}

/**
 * Get velocity data for the last N days
 * @deprecated Use getVelocityDataAsync() instead
 */
export function getVelocityData(_days: number = 90): DailySnapshot[] {
  // This is a sync wrapper around readVelocityData for now
  // In practice, routes will call readVelocityData directly
  throw new Error('Use getVelocityDataAsync() directly in routes')
}

/**
 * Get velocity data for the last N days (async version)
 */
export async function getVelocityDataAsync(days: number = 90): Promise<DailySnapshot[]> {
  const data = await readVelocityData()

  // Get date cutoff
  const cutoffDate = new Date()
  cutoffDate.setDate(cutoffDate.getDate() - days)
  const cutoffStr = cutoffDate.toISOString().substring(0, 10)

  // Filter to last N days
  return data.snapshots.filter(s => s.date >= cutoffStr)
}

/**
 * Calculate weekly average from snapshots
 */
export function getWeeklyAverage(snapshots: DailySnapshot[]): { todosPerWeek: number; commitsPerWeek: number } {
  if (snapshots.length === 0) {
    return { todosPerWeek: 0, commitsPerWeek: 0 }
  }

  const totalTodosClosed = snapshots.reduce((sum, s) => sum + s.todosClosed, 0)
  const totalCommits = snapshots.reduce((sum, s) => sum + s.commitsToday, 0)
  const totalDays = snapshots.length

  // Calculate daily average, then multiply by 7 for weekly
  const todosPerDay = totalTodosClosed / totalDays
  const commitsPerDay = totalCommits / totalDays

  return {
    todosPerWeek: todosPerDay * 7,
    commitsPerWeek: commitsPerDay * 7,
  }
}
