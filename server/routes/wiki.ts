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
} from '../lib/wiki-manager.js';

const router = Router();

const PROJECTS_DIR = process.env.PROJECTS_DIR || '';

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
    const resolvedProjectsDir = path.resolve(PROJECTS_DIR);
    const inProjects = resolvedPath.startsWith(resolvedProjectsDir + path.sep);

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

export { router as wikiRouter };
