import { promises as fs } from 'node:fs'
import path from 'node:path'
import { readProjectState } from './state-reader.js'
import type { ProjectState } from './state-reader.js'

/**
 * Scans the projects directory and returns all projects with state files
 * @param projectsDir - Base directory containing all projects
 * @returns Array of ProjectState objects sorted by lastModified descending
 */
export async function scanProjects(projectsDir: string): Promise<ProjectState[]> {
  const resolvedDir = path.resolve(projectsDir)

  // Read all immediate subdirectories
  let entries
  try {
    entries = await fs.readdir(resolvedDir, { withFileTypes: true })
  } catch (error) {
    console.error(`Failed to read projects directory: ${projectsDir}`, error)
    return []
  }

  // Filter for directories, skip hidden ones (starting with .)
  const directories = entries
    .filter(entry => entry.isDirectory() && !entry.name.startsWith('.'))
    .map(entry => path.join(resolvedDir, entry.name))

  // Read state for each project
  const projectPromises = directories.map(async (dir) => {
    try {
      return await readProjectState(dir, resolvedDir)
    } catch (error) {
      console.error(`Failed to read project state for ${dir}:`, error)
      return null
    }
  })

  const projects = await Promise.all(projectPromises)

  // Filter out null results (projects without state files or errors)
  const validProjects = projects.filter((p): p is ProjectState => p !== null)

  // Sort by lastModified descending (most recent first)
  validProjects.sort((a, b) => {
    return new Date(b.lastModified).getTime() - new Date(a.lastModified).getTime()
  })

  return validProjects
}
