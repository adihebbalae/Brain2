/**
 * Wiki routes for LLM Wiki management
 */

import { Router } from 'express';
import path from 'node:path';
import { promises as fs } from 'node:fs';
import { getPrimaryVaultDir, isPathInVault } from '../lib/vault-config.js';
import {
  ingestSource,
  readIndex,
  listPages,
  ensureWikiExists,
  queryWiki,
  lintWiki,
  analyzeGaps,
} from '../lib/wiki-manager.js';
import { getOllamaStatus } from '../lib/ollama-client.js';
import {
  enqueueImportJob,
  getActiveImportJobs,
  getImportJob,
} from '../lib/wiki-import-queue.js';
import { listWikiImportsState } from '../lib/wiki-imports.js';

const router = Router();

// Priority order for state file detection (same as scanner.ts)
const STATE_FILE_PRIORITY = [
  'agent_state.md',
  'Agent_State.json',
  'state.md',
  'Status.md',
  'README.md',
];

/**
 * POST /api/wiki/ingest
 * Ingest a source file into the wiki
 * Body: { sourcePath: string }
 */
router.post('/ingest', async (req, res) => {
  try {
    const { sourcePath } = req.body;

    if (!sourcePath || typeof sourcePath !== 'string') {
      return res.status(400).json({ error: 'sourcePath is required' });
    }

    // Validate: sourcePath must be inside a configured vault or projects dir
    const isValid = await isPathInVault(sourcePath);
    const resolvedPath = path.resolve(sourcePath);
    const projectsDir = process.env.PROJECTS_DIR || '';
    const resolvedProjectsDir = path.resolve(projectsDir);
    const inProjects = projectsDir && resolvedPath.startsWith(resolvedProjectsDir + path.sep);

    if (!isValid && !inProjects) {
      return res.status(403).json({
        error: 'Source path must be inside a configured vault or projects directory',
      });
    }

    // Check if source file exists
    try {
      await fs.access(sourcePath);
    } catch {
      return res.status(404).json({ error: 'Source file not found' });
    }

    // Get wiki directory (primary vault)
    const primaryVault = getPrimaryVaultDir();
    const wikiDir = path.join(primaryVault, 'Wiki');

    // Ensure wiki exists
    await ensureWikiExists(wikiDir);

    // Ingest the source
    const result = await ingestSource(sourcePath, wikiDir);

    // Always return 200 with errors in body (as per spec)
    res.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({ error: message });
  }
});

/**
 * GET /api/wiki/index
 * Get the wiki index (catalog of pages)
 * Returns: { pages: WikiPage[], wikiExists: boolean }
 */
router.get('/index', async (_req, res) => {
  try {
    const primaryVault = getPrimaryVaultDir();
    const wikiDir = path.join(primaryVault, 'Wiki');

    // Check if Wiki directory exists
    let wikiExists = false;
    try {
      await fs.access(wikiDir);
      wikiExists = true;
    } catch {
      // Wiki doesn't exist yet
      return res.json({ pages: [], wikiExists: false });
    }

    // Read index
    const pages = await readIndex(wikiDir);

    res.json({ pages, wikiExists });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({ error: message });
  }
});

/**
 * GET /api/wiki/pages
 * List all wiki pages with full metadata
 * Returns: { pages: WikiPage[] }
 */
router.get('/pages', async (_req, res) => {
  try {
    const primaryVault = getPrimaryVaultDir();
    const wikiDir = path.join(primaryVault, 'Wiki');

    // Check if Wiki directory exists
    try {
      await fs.access(wikiDir);
    } catch {
      // Wiki doesn't exist yet
      return res.json({ pages: [] });
    }

    // List all pages
    const pages = await listPages(wikiDir);

    res.json({ pages });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({ error: message });
  }
});

/**
 * POST /api/wiki/query
 * Query the wiki with a question
 * Body: { question: string }
 * Returns: QueryResult
 */
router.post('/query', async (req, res) => {
  try {
    const { question } = req.body;

    if (!question || typeof question !== 'string') {
      return res.status(400).json({ error: 'question is required' });
    }

    if (question.length > 500) {
      return res.status(400).json({ error: 'question must be 500 characters or less' });
    }

    if (question.trim().length === 0) {
      return res.status(400).json({ error: 'question cannot be empty' });
    }

    // Get wiki directory
    const primaryVault = getPrimaryVaultDir();
    const wikiDir = path.join(primaryVault, 'Wiki');

    // Query the wiki
    const result = await queryWiki(question, wikiDir);

    res.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({ error: message });
  }
});

/**
 * POST /api/wiki/lint
 * Lint the wiki to check health
 * Returns: LintResult + { wikiExists: boolean }
 */
router.post('/lint', async (_req, res) => {
  try {
    const primaryVault = getPrimaryVaultDir();
    const wikiDir = path.join(primaryVault, 'Wiki');

    // Check if Wiki directory exists
    let wikiExists = false;
    try {
      await fs.access(wikiDir);
      wikiExists = true;
    } catch {
      // Wiki doesn't exist yet
      return res.json({
        wikiExists: false,
        orphans: [],
        stale: [],
        gaps: [],
        healthScore: 100,
      });
    }

    // Lint the wiki
    const result = await lintWiki(wikiDir);

    res.json({
      ...result,
      wikiExists,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({ error: message });
  }
});

/**
 * POST /api/wiki/gaps
 * Analyze knowledge gaps and fetch resource recommendations
 * Returns: GapAnalysisResult (always HTTP 200, errors in body)
 */
router.post('/gaps', async (_req, res) => {
  try {
    const primaryVault = getPrimaryVaultDir();
    const wikiDir = path.join(primaryVault, 'Wiki');

    // Check if Wiki directory exists
    try {
      await fs.access(wikiDir);
    } catch {
      // Wiki doesn't exist yet
      return res.json({
        gaps: [],
        generatedAt: new Date().toISOString(),
        error: 'Wiki not initialized',
      });
    }

    // Analyze gaps
    const projectsDir = process.env.PROJECTS_DIR || '';
    const result = await analyzeGaps(wikiDir, projectsDir);

    res.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.json({
      gaps: [],
      generatedAt: new Date().toISOString(),
      error: message,
    });
  }
});

/**
 * GET /api/wiki/imports
 * Return discovered datasets plus any active background jobs.
 */
router.get('/imports', async (_req, res) => {
  try {
    const [state, activeJobs] = await Promise.all([
      listWikiImportsState(),
      getActiveImportJobs(),
    ]);

    res.json({
      datasets: state.datasets,
      activeJobs,
      lastScannedAt: state.lastScannedAt,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({ error: message });
  }
});

/**
 * POST /api/wiki/imports/scan
 * Queue a background scan job.
 */
router.post('/imports/scan', async (_req, res) => {
  try {
    const job = await enqueueImportJob({ type: 'scan' });
    res.json({ jobId: job.id });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({ error: message });
  }
});

/**
 * POST /api/wiki/imports/normalize
 * Queue a background normalize job.
 */
router.post('/imports/normalize', async (req, res) => {
  try {
    const { datasetIds } = req.body ?? {};

    if (datasetIds !== undefined && !Array.isArray(datasetIds)) {
      return res.status(400).json({ error: 'datasetIds must be an array when provided' });
    }

    if (Array.isArray(datasetIds) && datasetIds.some(id => typeof id !== 'string' || id.trim().length === 0)) {
      return res.status(400).json({ error: 'datasetIds must contain non-empty strings only' });
    }

    const job = await enqueueImportJob({
      type: 'normalize',
      datasetIds,
    });

    return res.json({ jobId: job.id });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return res.status(500).json({ error: message });
  }
});

/**
 * POST /api/wiki/imports/ingest
 * Queue a background ingest job.
 */
router.post('/imports/ingest', async (req, res) => {
  try {
    const { datasetIds, mode } = req.body ?? {};

    if (!Array.isArray(datasetIds) || datasetIds.length === 0) {
      return res.status(400).json({ error: 'datasetIds is required' });
    }

    if (datasetIds.some(id => typeof id !== 'string' || id.trim().length === 0)) {
      return res.status(400).json({ error: 'datasetIds must contain non-empty strings only' });
    }

    if (mode !== undefined && !['default', 'rollups', 'full-mirror'].includes(mode)) {
      return res.status(400).json({ error: 'mode must be default, rollups, or full-mirror' });
    }

    const job = await enqueueImportJob({
      type: 'ingest',
      datasetIds,
      mode,
    });

    return res.json({ jobId: job.id });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return res.status(500).json({ error: message });
  }
});

/**
 * GET /api/wiki/import-jobs/:jobId
 * Return a persisted job snapshot.
 */
router.get('/import-jobs/:jobId', async (req, res) => {
  try {
    const job = await getImportJob(req.params.jobId);
    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }

    return res.json(job);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return res.status(500).json({ error: message });
  }
});

/**
 * POST /api/wiki/ingest-projects
 * Bulk-ingest project state files from all projects in PROJECTS_DIR
 * Returns: { ingested: number, errors: string[] } (always HTTP 200)
 */
router.post('/ingest-projects', async (_req, res) => {
  try {
    // Check Ollama availability first
    const ollamaStatus = await getOllamaStatus();
    if (!ollamaStatus.available) {
      return res.json({
        ingested: 0,
        errors: ['Ollama not available — start it first'],
      });
    }

    // Validate PROJECTS_DIR is set
    const projectsDir = process.env.PROJECTS_DIR || '';
    if (!projectsDir) {
      return res.json({
        ingested: 0,
        errors: ['PROJECTS_DIR not configured'],
      });
    }

    const resolvedProjectsDir = path.resolve(projectsDir);

    // Read all immediate subdirectories
    let entries;
    try {
      entries = await fs.readdir(resolvedProjectsDir, { withFileTypes: true });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      return res.json({
        ingested: 0,
        errors: [`Failed to read projects directory: ${message}`],
      });
    }

    // Filter for directories, skip hidden ones (starting with .)
    const directories = entries
      .filter(entry => entry.isDirectory() && !entry.name.startsWith('.'))
      .map(entry => path.join(resolvedProjectsDir, entry.name));

    // Get wiki directory
    const primaryVault = getPrimaryVaultDir();
    const wikiDir = path.join(primaryVault, 'Wiki');

    // Ensure wiki exists
    await ensureWikiExists(wikiDir);

    // For each project directory, find and ingest state file
    let ingested = 0;
    const errors: string[] = [];

    for (const projectDir of directories) {
      try {
        // Find first existing state file
        let stateFilePath: string | null = null;
        for (const filename of STATE_FILE_PRIORITY) {
          const filePath = path.join(projectDir, filename);
          const resolvedPath = path.resolve(filePath);

          // Path traversal protection: validate path is inside PROJECTS_DIR
          if (!resolvedPath.startsWith(resolvedProjectsDir + path.sep)) {
            continue;
          }

          try {
            await fs.access(filePath);
            stateFilePath = filePath;
            break;
          } catch {
            // File doesn't exist, try next
            continue;
          }
        }

        // If no state file found, skip this project
        if (!stateFilePath) {
          continue;
        }

        // Ingest the state file
        const result = await ingestSource(stateFilePath, wikiDir);

        if (result.error) {
          errors.push(`${path.basename(projectDir)}: ${result.error}`);
        } else {
          ingested++;
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        errors.push(`${path.basename(projectDir)}: ${message}`);
      }
    }

    // Always return HTTP 200 with errors in body
    res.json({
      ingested,
      errors,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.json({
      ingested: 0,
      errors: [message],
    });
  }
});

export { router as wikiRouter };
