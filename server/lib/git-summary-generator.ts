import { execSync } from 'node:child_process'
import { promises as fs } from 'node:fs'
import path from 'node:path'
import { getOllamaStatus } from './ollama-client.js'

/**
 * Generates a weekly git summary for a project directory.
 * Runs `git log --since=7.days --stat`, feeds to Ollama for summarization,
 * and writes the result to `.cortex-weekly-summary.md` in the project directory.
 *
 * @param projectPath - Absolute path to the project directory
 * @param projectName - Name of the project
 * @returns Summary text if successful, null if no commits or Ollama unavailable
 */
export async function generateProjectGitSummary(
  projectPath: string,
  projectName: string
): Promise<string | null> {
  // Check if .git directory exists
  const gitDir = path.join(projectPath, '.git')
  try {
    const stats = await fs.stat(gitDir)
    if (!stats.isDirectory()) {
      console.log(`[git-summary] No .git directory found in ${projectName}`)
      return null
    }
  } catch {
    console.log(`[git-summary] No .git directory found in ${projectName}`)
    return null
  }

  // Run git log for last 7 days
  let gitLogOutput: string
  try {
    gitLogOutput = execSync(
      `git log --since=7.days --stat`,
      {
        cwd: projectPath,
        encoding: 'utf-8',
        timeout: 10000, // 10 second timeout
        stdio: ['pipe', 'pipe', 'pipe'], // Suppress stderr
      }
    )

    // Check if there are any commits
    if (!gitLogOutput || gitLogOutput.trim().length === 0) {
      console.log(`[git-summary] No commits in last 7 days for ${projectName}`)
      return null
    }
  } catch (error) {
    console.warn(`[git-summary] Git log failed for ${projectName}:`, error instanceof Error ? error.message : String(error))
    return null
  }

  // Check if Ollama is available
  const ollamaStatus = await getOllamaStatus()
  if (!ollamaStatus.available) {
    console.warn(`[git-summary] Ollama not available, skipping summary for ${projectName}`)
    return null
  }

  // Truncate git log output to prevent overwhelming Ollama (max 4000 chars)
  const truncatedLog = gitLogOutput.slice(0, 4000)

  // Build prompt for Ollama
  const prompt = `Summarize this week's development activity in 3-4 sentences.
What was worked on? What changed? Be factual, only use the git log below.

Git log for project "${projectName}":
${truncatedLog}`

  // Call Ollama
  const OLLAMA_URL = process.env.OLLAMA_URL || 'http://localhost:11434'
  const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'llama3.1:8b'
  const OLLAMA_KEEP_ALIVE = process.env.OLLAMA_KEEP_ALIVE || '30m'

  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 30000) // 30 second timeout

    const response = await fetch(`${OLLAMA_URL}/api/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: OLLAMA_MODEL,
        prompt,
        stream: false,
        keep_alive: OLLAMA_KEEP_ALIVE,
      }),
      signal: controller.signal,
    })

    clearTimeout(timeout)

    if (!response.ok) {
      console.error(`[git-summary] Ollama API error ${response.status} for ${projectName}`)
      return null
    }

    const data = await response.json()
    const summary = data.response?.trim() || null

    if (!summary) {
      console.warn(`[git-summary] Ollama returned empty summary for ${projectName}`)
      return null
    }

    // Write summary to file with date header
    const now = new Date()
    const dateHeader = `# Weekly Development Summary — ${now.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    })}\n\n`
    const fileContent = dateHeader + summary + '\n'

    const summaryPath = path.join(projectPath, '.cortex-weekly-summary.md')
    await fs.writeFile(summaryPath, fileContent, 'utf-8')

    console.log(`[git-summary] Summary written for ${projectName}`)
    return summary

  } catch (error) {
    console.error(`[git-summary] Failed to generate summary for ${projectName}:`, error instanceof Error ? error.message : String(error))
    return null
  }
}
