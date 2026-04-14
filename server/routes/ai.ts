/**
 * AI routes for Ollama summarization
 */

import { Router } from 'express';
import { getOllamaStatus, summarizeProject } from '../lib/ollama-client.js';
import { scanProjects } from '../lib/scanner.js';
import * as fs from 'fs/promises';
import * as path from 'path';

const router = Router();

const PROJECTS_DIR = process.env.PROJECTS_DIR || '';

/**
 * GET /api/ai/status
 * Check if Ollama is reachable
 */
router.get('/status', async (_req, res) => {
  try {
    const status = await getOllamaStatus();
    res.json(status);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({ error: message });
  }
});

/**
 * GET /api/ai/summarize/:project
 * Get AI summary for a single project
 */
router.get('/summarize/:project', async (req, res) => {
  try {
    const projectName = req.params.project;

    // Find the project to get its state file path
    const projects = await scanProjects(PROJECTS_DIR);
    const project = projects.find((p) => p.name === projectName);

    if (!project || !project.stateFile) {
      return res.status(404).json({ error: 'Project not found' });
    }

    const stateFilePath = project.stateFile;

    // Path traversal protection: ensure the path is within PROJECTS_DIR
    const resolvedPath = path.resolve(stateFilePath);
    const resolvedProjectsDir = path.resolve(PROJECTS_DIR);

    if (!resolvedPath.startsWith(resolvedProjectsDir)) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Read the state file
    const stateFileContent = await fs.readFile(stateFilePath, 'utf-8');
    const stats = await fs.stat(stateFilePath);
    const fileMtime = stats.mtimeMs;

    // Get summary
    const result = await summarizeProject(projectName, stateFileContent, fileMtime);

    res.json({
      name: projectName,
      summary: result.summary,
      cached: result.cached,
      error: result.error,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({ error: message });
  }
});

/**
 * POST /api/ai/summarize-all
 * Bulk summarize multiple projects
 * Body: { projects: Array<{ name: string, stateFilePath: string }> }
 */
router.post('/summarize-all', async (req, res) => {
  try {
    const { projects } = req.body;

    if (!Array.isArray(projects)) {
      return res.status(400).json({ error: 'projects must be an array' });
    }

    const results: Array<{
      name: string;
      summary: string | null;
      cached: boolean;
      error?: string;
    }> = [];

    // Process sequentially to avoid overwhelming Ollama
    for (const project of projects) {
      const { name, stateFilePath } = project;

      if (!name || !stateFilePath) {
        results.push({
          name: name || 'unknown',
          summary: null,
          cached: false,
          error: 'Invalid project data',
        });
        continue;
      }

      try {
        // Path traversal protection
        const resolvedPath = path.resolve(stateFilePath);
        const resolvedProjectsDir = path.resolve(PROJECTS_DIR);

        if (!resolvedPath.startsWith(resolvedProjectsDir)) {
          results.push({
            name,
            summary: null,
            cached: false,
            error: 'Access denied',
          });
          continue;
        }

        // Read state file
        const stateFileContent = await fs.readFile(stateFilePath, 'utf-8');
        const stats = await fs.stat(stateFilePath);
        const fileMtime = stats.mtimeMs;

        // Get summary
        const result = await summarizeProject(name, stateFileContent, fileMtime);

        results.push({
          name,
          summary: result.summary,
          cached: result.cached,
          error: result.error,
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        results.push({
          name,
          summary: null,
          cached: false,
          error: message,
        });
      }
    }

    res.json({ results });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({ error: message });
  }
});

export { router as aiRouter };
