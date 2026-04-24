/**
 * AI routes for Ollama summarization
 */

import { Router } from 'express'
import * as fs from 'fs/promises'
import * as path from 'path'
import { getOllamaStatus, summarizeProjectAspect } from '../lib/ollama-client.js'
import { scanProjects } from '../lib/scanner.js'
import { prepareContentForAi, type ProjectState } from '../lib/state-reader.js'

const router = Router()
const PROJECTS_DIR = process.env.PROJECTS_DIR || ''

interface ProjectSummaryResponse {
  name: string
  summary: string
  currentState: string
  summaryCached: boolean
  currentStateCached: boolean
  summaryError?: string
  currentStateError?: string
}

function resolveProjectFilePath(projectRoot: string, relativeFilePath: string): string {
  const resolvedPath = path.resolve(projectRoot, relativeFilePath)
  const resolvedProjectRoot = path.resolve(projectRoot)

  if (!resolvedPath.startsWith(resolvedProjectRoot + path.sep) && resolvedPath !== resolvedProjectRoot) {
    throw new Error('Access denied')
  }

  return resolvedPath
}

async function summarizeProjectFiles(project: ProjectState): Promise<ProjectSummaryResponse> {
  const response: ProjectSummaryResponse = {
    name: project.name,
    summary: project.summary,
    currentState: project.currentState ?? '',
    summaryCached: false,
    currentStateCached: false,
  }

  if (project.summaryFile) {
    try {
      const summaryPath = resolveProjectFilePath(project.path, project.summaryFile)
      const [content, stats] = await Promise.all([
        fs.readFile(summaryPath, 'utf-8'),
        fs.stat(summaryPath),
      ])

      const prepared = prepareContentForAi(content, project.summaryFile, 'overview')
      if (prepared) {
        const result = await summarizeProjectAspect(
          project.name,
          prepared,
          project.summaryFile,
          stats.mtimeMs,
          'overview'
        )

        if (result.summary) {
          response.summary = result.summary
        }
        response.summaryCached = result.cached
        response.summaryError = result.error
      }
    } catch (error) {
      response.summaryError = error instanceof Error ? error.message : 'Unknown error'
    }
  }

  if (project.currentStateFile) {
    try {
      const statePath = resolveProjectFilePath(project.path, project.currentStateFile)
      const [content, stats] = await Promise.all([
        fs.readFile(statePath, 'utf-8'),
        fs.stat(statePath),
      ])

      const prepared = prepareContentForAi(content, project.currentStateFile, 'current_state')
      if (prepared) {
        const result = await summarizeProjectAspect(
          project.name,
          prepared,
          project.currentStateFile,
          stats.mtimeMs,
          'current_state'
        )

        if (result.summary) {
          response.currentState = result.summary
        }
        response.currentStateCached = result.cached
        response.currentStateError = result.error
      }
    } catch (error) {
      response.currentStateError = error instanceof Error ? error.message : 'Unknown error'
    }
  }

  return response
}

function getRequestedProjectNames(rawProjects: unknown): string[] | null {
  if (rawProjects == null) {
    return null
  }

  if (!Array.isArray(rawProjects)) {
    throw new Error('projects must be an array')
  }

  return rawProjects
    .map(project => {
      if (typeof project === 'string') {
        return project
      }

      if (project && typeof project === 'object' && 'name' in project) {
        const name = (project as { name?: unknown }).name
        return typeof name === 'string' ? name : null
      }

      return null
    })
    .filter((name): name is string => Boolean(name))
}

router.get('/status', async (_req, res) => {
  try {
    const status = await getOllamaStatus()
    res.json(status)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    res.status(500).json({ error: message })
  }
})

router.get('/summarize/:project', async (req, res) => {
  try {
    const projectName = req.params.project
    const projects = await scanProjects(PROJECTS_DIR)
    const project = projects.find(item => item.name === projectName)

    if (!project) {
      return res.status(404).json({ error: 'Project not found' })
    }

    const result = await summarizeProjectFiles(project)
    return res.json(result)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return res.status(500).json({ error: message })
  }
})

router.post('/summarize-all', async (req, res) => {
  try {
    let requestedNames: string[] | null

    try {
      requestedNames = getRequestedProjectNames(req.body?.projects)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Invalid request'
      return res.status(400).json({ error: message })
    }

    const allProjects = await scanProjects(PROJECTS_DIR)
    const selectedProjects =
      requestedNames && requestedNames.length > 0
        ? allProjects.filter(project => requestedNames!.includes(project.name))
        : allProjects

    const results: ProjectSummaryResponse[] = []
    for (const project of selectedProjects) {
      results.push(await summarizeProjectFiles(project))
    }

    return res.json({ results })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return res.status(500).json({ error: message })
  }
})

export { router as aiRouter }
