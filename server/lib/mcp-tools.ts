/**
 * MCP Tool Handlers
 * Wraps existing Cortex lib functions as MCP tools
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import { extractTodosMultiVault } from './todo-extractor.js'
import { readDeadlinesMultiVault } from './deadline-reader.js'
import { scanProjects } from './scanner.js'
import { appendCapture } from './capture-writer.js'
import { queryWiki } from './wiki-manager.js'
import { parseReadingLog } from './reading-log-parser.js'
import { getGitActivity } from './git-activity-parser.js'
import { getVaultDirs, getPrimaryVaultDir } from './vault-config.js'
import { promises as fs } from 'node:fs'
import path from 'node:path'
import { extractKeywords } from './rag-engine.js'

/**
 * Search notes across vault directories using keyword matching
 */
async function searchNotes(query: string, limit = 10): Promise<any> {
  try {
    const vaultDirs = await getVaultDirs()
    if (vaultDirs.length === 0) {
      return { error: 'No vault directories configured' }
    }

    const keywords = extractKeywords(query)
    const results: Array<{ title: string; path: string; preview: string; score: number }> = []

    // Scan all vault directories
    for (const vaultDir of vaultDirs) {
      try {
        await fs.access(vaultDir)
      } catch {
        continue // Skip non-existent vaults
      }

      // Find all markdown files
      const files = await findMarkdownFiles(vaultDir)

      for (const file of files) {
        // Skip Wiki directory (has its own search tool)
        if (file.includes(path.sep + 'Wiki' + path.sep)) continue

        try {
          const content = await fs.readFile(file, 'utf-8')
          const filename = path.basename(file, '.md')

          // Score by keyword matches
          let score = 0
          const lowerContent = content.toLowerCase()
          const lowerFilename = filename.toLowerCase()

          for (const keyword of keywords) {
            // Title match (3x weight)
            if (lowerFilename.includes(keyword)) score += 3

            // Content match
            const contentMatches = (lowerContent.match(new RegExp(keyword, 'g')) || []).length
            score += contentMatches
          }

          if (score > 0) {
            // Extract preview (first 150 chars)
            const preview = content.slice(0, 150).replace(/\n/g, ' ').trim()
            results.push({ title: filename, path: file, preview, score })
          }
        } catch {
          // Skip files that can't be read
          continue
        }
      }
    }

    // Sort by score descending and limit
    results.sort((a, b) => b.score - a.score)
    return results.slice(0, limit)
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Failed to search notes' }
  }
}

/**
 * Recursively find all markdown files in a directory
 */
async function findMarkdownFiles(dir: string): Promise<string[]> {
  const results: string[] = []

  try {
    const entries = await fs.readdir(dir, { withFileTypes: true })

    for (const entry of entries) {
      // Skip hidden directories and node_modules
      if (entry.name.startsWith('.') || entry.name === 'node_modules') continue

      const fullPath = path.join(dir, entry.name)

      if (entry.isDirectory()) {
        const subFiles = await findMarkdownFiles(fullPath)
        results.push(...subFiles)
      } else if (entry.isFile() && entry.name.endsWith('.md')) {
        results.push(fullPath)
      }
    }
  } catch {
    // Directory doesn't exist or can't be read
  }

  return results
}

/**
 * Get daily context: today's deadlines, stale projects, git activity
 */
async function getDailyContext(): Promise<any> {
  try {
    const vaultDirs = await getVaultDirs()

    // Get today's and upcoming deadlines (next 3 days)
    const allDeadlines = await readDeadlinesMultiVault(vaultDirs)
    const upcomingDeadlines = allDeadlines
      .filter(d => !d.done && d.daysUntil >= 0 && d.daysUntil <= 3)
      .slice(0, 5)

    // Get stale projects (30+ days)
    const projects = await scanProjects(process.env.PROJECTS_DIR || '')
    const staleProjects = projects
      .filter(p => p.staleDays >= 30)
      .slice(0, 3)
      .map(p => ({ name: p.name, staleDays: p.staleDays, summary: p.summary }))

    // Get git activity
    let gitActivity = { commitsToday: 0, commitsThisWeek: 0 }
    try {
      const gitData = await getGitActivity(process.env.PROJECTS_DIR || '')
      const today = new Date().toISOString().split('T')[0]
      gitActivity.commitsToday = gitData.heatmap[today] || 0
      gitActivity.commitsThisWeek = gitData.totalCommitsLast30Days // Approximation
    } catch {
      // Git activity is optional
    }

    return {
      date: new Date().toISOString().split('T')[0],
      deadlines: upcomingDeadlines,
      staleProjects,
      gitActivity,
    }
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Failed to get daily context' }
  }
}

/**
 * Register all MCP tools with the server
 */
export function registerTools(server: McpServer): void {
  // Tool 1: list_todos
  server.tool(
    'list_todos',
    'List all TODO items from projects and vault',
    z.object({
      filter: z.enum(['open', 'done', 'all']).optional().default('open').describe('Filter by status'),
    }),
    async (args) => {
      try {
        const filter = args.filter || 'open'
        const vaultDirs = await getVaultDirs()
        const result = await extractTodosMultiVault(process.env.PROJECTS_DIR || '', vaultDirs)

        // Filter todos
        let todos: any[] = []
        for (const projectTodos of Object.values(result.byProject)) {
          todos.push(...projectTodos)
        }

        if (filter === 'open') {
          todos = todos.filter(t => !t.done)
        } else if (filter === 'done') {
          todos = todos.filter(t => t.done)
        }

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({ total: todos.length, todos }, null, 2),
            },
          ],
        }
      } catch (error) {
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({ error: error instanceof Error ? error.message : 'Failed to list todos' }),
            },
          ],
          isError: true,
        }
      }
    }
  )

  // Tool 2: get_deadlines
  server.tool(
    'get_deadlines',
    'Get upcoming deadlines from vault',
    z.object({
      days: z.number().optional().default(7).describe('Number of upcoming days to include'),
    }),
    async (args) => {
      try {
        const days = args.days || 7
        const vaultDirs = await getVaultDirs()
        const allDeadlines = await readDeadlinesMultiVault(vaultDirs)

        // Filter to upcoming deadlines within N days
        const upcoming = allDeadlines.filter(
          d => !d.done && d.daysUntil >= 0 && d.daysUntil <= days
        )

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({ count: upcoming.length, deadlines: upcoming }, null, 2),
            },
          ],
        }
      } catch (error) {
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({ error: error instanceof Error ? error.message : 'Failed to get deadlines' }),
            },
          ],
          isError: true,
        }
      }
    }
  )

  // Tool 3: list_projects
  server.tool(
    'list_projects',
    'List all projects from projects directory',
    z.object({
      status: z.enum(['active', 'stale', 'all']).optional().default('all').describe('Filter by status'),
    }),
    async (args) => {
      try {
        const statusFilter = args.status || 'all'
        const projects = await scanProjects(process.env.PROJECTS_DIR || '')

        // Filter projects
        let filtered = projects
        if (statusFilter === 'active') {
          filtered = projects.filter(p => p.staleDays < 30)
        } else if (statusFilter === 'stale') {
          filtered = projects.filter(p => p.staleDays >= 30)
        }

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  count: filtered.length,
                  projects: filtered.map(p => ({
                    name: p.name,
                    status: p.status,
                    staleDays: p.staleDays,
                    summary: p.summary,
                    nextSteps: p.nextSteps,
                  })),
                },
                null,
                2
              ),
            },
          ],
        }
      } catch (error) {
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({ error: error instanceof Error ? error.message : 'Failed to list projects' }),
            },
          ],
          isError: true,
        }
      }
    }
  )

  // Tool 4: search_notes
  server.tool(
    'search_notes',
    'Search notes across vault using keyword matching',
    z.object({
      query: z.string().describe('Search query'),
      limit: z.number().optional().default(10).describe('Maximum number of results'),
    }),
    async (args) => {
      try {
        const results = await searchNotes(args.query, args.limit || 10)

        if ('error' in results) {
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify({ error: results.error }),
              },
            ],
            isError: true,
          }
        }

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({ count: results.length, results }, null, 2),
            },
          ],
        }
      } catch (error) {
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({ error: error instanceof Error ? error.message : 'Failed to search notes' }),
            },
          ],
          isError: true,
        }
      }
    }
  )

  // Tool 5: add_capture
  server.tool(
    'add_capture',
    'Add a quick capture to inbox',
    z.object({
      text: z.string().describe('Text to capture'),
    }),
    async (args) => {
      try {
        const vaultDir = getPrimaryVaultDir()
        if (!vaultDir) {
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify({ error: 'No vault directory configured' }),
              },
            ],
            isError: true,
          }
        }

        const entry = await appendCapture(args.text, vaultDir)

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({ success: true, entry }),
            },
          ],
        }
      } catch (error) {
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({ error: error instanceof Error ? error.message : 'Failed to add capture' }),
            },
          ],
          isError: true,
        }
      }
    }
  )

  // Tool 6: get_daily_context
  server.tool(
    'get_daily_context',
    'Get daily context: today\'s deadlines, stale projects, and git activity',
    z.object({}),
    async () => {
      try {
        const context = await getDailyContext()

        if ('error' in context) {
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify({ error: context.error }),
              },
            ],
            isError: true,
          }
        }

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(context, null, 2),
            },
          ],
        }
      } catch (error) {
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({ error: error instanceof Error ? error.message : 'Failed to get daily context' }),
            },
          ],
          isError: true,
        }
      }
    }
  )

  // Tool 7: search_wiki
  server.tool(
    'search_wiki',
    'Search wiki using natural language query',
    z.object({
      query: z.string().describe('Search query'),
      limit: z.number().optional().default(5).describe('Maximum number of results'),
    }),
    async (args) => {
      try {
        const vaultDir = getPrimaryVaultDir()
        if (!vaultDir) {
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify({ error: 'No vault directory configured' }),
              },
            ],
            isError: true,
          }
        }

        const wikiDir = path.join(vaultDir, 'Wiki')
        const result = await queryWiki(args.query, wikiDir)

        if (result.error) {
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify({ error: result.error }),
              },
            ],
            isError: true,
          }
        }

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({ answer: result.answer, citations: result.citations }, null, 2),
            },
          ],
        }
      } catch (error) {
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({ error: error instanceof Error ? error.message : 'Failed to search wiki' }),
            },
          ],
          isError: true,
        }
      }
    }
  )

  // Tool 8: get_reading_log
  server.tool(
    'get_reading_log',
    'Get reading log items from vault',
    z.object({
      status: z.enum(['read', 'unread', 'all']).optional().default('all').describe('Filter by status'),
    }),
    async (args) => {
      try {
        const statusFilter = args.status || 'all'
        const vaultDir = getPrimaryVaultDir()

        if (!vaultDir) {
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify({ error: 'No vault directory configured' }),
              },
            ],
            isError: true,
          }
        }

        const items = await parseReadingLog(vaultDir)

        // Filter by status
        let filtered = items
        if (statusFilter === 'read') {
          filtered = items.filter(i => i.read)
        } else if (statusFilter === 'unread') {
          filtered = items.filter(i => !i.read)
        }

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({ count: filtered.length, items: filtered }, null, 2),
            },
          ],
        }
      } catch (error) {
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({ error: error instanceof Error ? error.message : 'Failed to get reading log' }),
            },
          ],
          isError: true,
        }
      }
    }
  )
}
