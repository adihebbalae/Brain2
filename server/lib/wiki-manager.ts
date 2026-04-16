/**
 * LLM Wiki Manager
 * Based on Karpathy's LLM Wiki pattern (April 2026)
 * Manages wiki pages, index, and ingest operations
 */

import { promises as fs } from 'node:fs';
import path from 'node:path';
import { getOllamaStatus } from './ollama-client.js';
import { isPathInVault } from './vault-config.js';

export interface WikiPage {
  name: string;           // filename without .md
  path: string;           // absolute path
  title: string;          // from frontmatter or filename
  status: string;         // seedling | developing | mature
  sources: string[];      // from frontmatter sources array
  lastUpdated: string;    // from frontmatter last_updated
  summary: string;        // from index.md one-liner
}

export interface IngestResult {
  pagesCreated: string[];
  pagesUpdated: string[];
  error?: string;
}

const SCHEMA_CONTENT = `# Cortex Wiki Schema

> Maintained by Cortex + Ollama. Do not edit manually — changes will be overwritten.
> Based on Karpathy's LLM Wiki pattern (April 2026).

## Directory Structure

- \`index.md\` — Catalog of all pages. Updated on every ingest.
- \`log.md\` — Append-only ingest/query/lint log.
- \`SCHEMA.md\` — This file. Conventions guide.
- \`*.md\` — Topic/entity/concept pages.

## Page Conventions

- **Title**: Use \`[[Wikilink]]\` format for cross-references to other pages.
- **Frontmatter**: Every page has YAML frontmatter:
  \`\`\`yaml
  ---
  title: Page Title
  status: seedling | developing | mature
  sources: [relative/path/to/source.md]
  last_updated: YYYY-MM-DD
  ---
  \`\`\`
- **Page types**: entity (person, project, tool), concept (idea, framework), source (summary of a raw source), synthesis (cross-source analysis).

## Index Format

Each line in index.md:
\`\`\`
- [[Page Name]] — One-line summary. (sources: N)
\`\`\`

## Log Format

Each entry in log.md:
\`\`\`
## [YYYY-MM-DD HH:mm] ingest | Source: filename.md
Brief note about what was added/updated.
\`\`\`
`;

const OLLAMA_URL = process.env.OLLAMA_URL || 'http://localhost:11434';
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'llama3.1:8b';

/**
 * Ensures Wiki/ directory and SCHEMA.md exist.
 * Creates them if not present. Safe to call on every ingest.
 */
export async function ensureWikiExists(wikiDir: string): Promise<void> {
  // Create Wiki/ directory if not exists
  try {
    await fs.mkdir(wikiDir, { recursive: true });
  } catch (error) {
    // Ignore error if directory already exists
    if ((error as NodeJS.ErrnoException).code !== 'EEXIST') {
      throw error;
    }
  }

  // Create SCHEMA.md if not exists
  const schemaPath = path.join(wikiDir, 'SCHEMA.md');
  try {
    await fs.access(schemaPath);
    // File exists, do nothing
  } catch {
    // File doesn't exist, create it
    await fs.writeFile(schemaPath, SCHEMA_CONTENT, 'utf-8');
  }

  // Create index.md if not exists
  const indexPath = path.join(wikiDir, 'index.md');
  try {
    await fs.access(indexPath);
  } catch {
    await fs.writeFile(indexPath, '# Wiki Index\n\n', 'utf-8');
  }

  // Create log.md if not exists
  const logPath = path.join(wikiDir, 'log.md');
  try {
    await fs.access(logPath);
  } catch {
    await fs.writeFile(logPath, '# Wiki Log\n\n', 'utf-8');
  }
}

/**
 * Main ingest function.
 * Reads source file, sends to Ollama with wiki-aware prompt, parses response,
 * creates/updates wiki pages, updates index.md, appends to log.md.
 */
export async function ingestSource(
  sourcePath: string,
  wikiDir: string
): Promise<IngestResult> {
  // Validate source path is in a vault
  const isValid = await isPathInVault(sourcePath);
  if (!isValid) {
    return {
      pagesCreated: [],
      pagesUpdated: [],
      error: 'Source path must be inside a configured vault directory',
    };
  }

  // Ensure Wiki exists
  await ensureWikiExists(wikiDir);

  // Check if Ollama is available
  const ollamaStatus = await getOllamaStatus();
  if (!ollamaStatus.available) {
    return {
      pagesCreated: [],
      pagesUpdated: [],
      error: 'Ollama unavailable',
    };
  }

  // Read source file
  let sourceContent: string;
  try {
    sourceContent = await fs.readFile(sourcePath, 'utf-8');
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return {
      pagesCreated: [],
      pagesUpdated: [],
      error: `Failed to read source file: ${message}`,
    };
  }

  // Truncate content to 4000 chars
  const truncatedContent = sourceContent.slice(0, 4000);

  // Get relative path for sources frontmatter
  const relativePath = path.basename(sourcePath);

  // Build Ollama prompt
  const prompt = `You are maintaining a personal wiki. Given this source document, do the following:

1. Extract the 3-5 most important concepts, entities, or ideas.
2. For each, write a brief wiki page (2-4 paragraphs) using [[Wikilink]] for cross-references.
3. Use this exact format for each page:

---WIKI_PAGE---
name: PageName
status: seedling
sources: ${relativePath}
content:
# PageName

[page content with [[wikilinks]] for related concepts]

---END_PAGE---

Source document:
${truncatedContent}`;

  // Call Ollama
  let ollamaResponse: string;
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 60000); // 60 second timeout

    const response = await fetch(`${OLLAMA_URL}/api/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: OLLAMA_MODEL,
        prompt,
        stream: false,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!response.ok) {
      return {
        pagesCreated: [],
        pagesUpdated: [],
        error: `Ollama API error: ${response.status}`,
      };
    }

    const data = await response.json();
    ollamaResponse = data.response?.trim() || '';

    if (!ollamaResponse) {
      return {
        pagesCreated: [],
        pagesUpdated: [],
        error: 'Ollama returned empty response',
      };
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return {
      pagesCreated: [],
      pagesUpdated: [],
      error: `Failed to call Ollama: ${message}`,
    };
  }

  // Parse Ollama response to extract wiki pages
  const pages = parseWikiPages(ollamaResponse, relativePath);

  if (pages.length === 0) {
    return {
      pagesCreated: [],
      pagesUpdated: [],
      error: 'No wiki pages extracted from Ollama response',
    };
  }

  const pagesCreated: string[] = [];
  const pagesUpdated: string[] = [];

  // Process each parsed page
  for (const page of pages) {
    const pagePath = path.join(wikiDir, `${page.name}.md`);

    try {
      // Check if page exists
      let pageExists = false;
      try {
        await fs.access(pagePath);
        pageExists = true;
      } catch {
        // Page doesn't exist
      }

      if (pageExists) {
        // Update existing page
        const existingContent = await fs.readFile(pagePath, 'utf-8');
        const updatedContent = await mergeWikiPage(
          existingContent,
          page.content,
          page.sources
        );
        await fs.writeFile(pagePath, updatedContent, 'utf-8');
        pagesUpdated.push(page.name);
      } else {
        // Create new page
        const newContent = createWikiPage(
          page.title,
          page.status,
          page.sources,
          page.content
        );
        await fs.writeFile(pagePath, newContent, 'utf-8');
        pagesCreated.push(page.name);
      }
    } catch (error) {
      console.error(`Failed to write page ${page.name}:`, error);
    }
  }

  // Update index.md
  await updateIndex(wikiDir, pages);

  // Append to log.md
  const sourceFileName = path.basename(sourcePath);
  const logDetail = `Created ${pagesCreated.length} pages, updated ${pagesUpdated.length} pages from ${sourceFileName}`;
  await appendLog(wikiDir, 'ingest', logDetail);

  return {
    pagesCreated,
    pagesUpdated,
  };
}

/**
 * Parse Ollama response to extract wiki pages
 */
function parseWikiPages(
  response: string,
  defaultSource: string
): Array<{
  name: string;
  title: string;
  status: string;
  sources: string[];
  content: string;
}> {
  const pages: Array<{
    name: string;
    title: string;
    status: string;
    sources: string[];
    content: string;
  }> = [];

  // Split by ---WIKI_PAGE--- marker
  const pageBlocks = response.split('---WIKI_PAGE---').slice(1);

  for (const block of pageBlocks) {
    // Find ---END_PAGE--- marker
    const endIndex = block.indexOf('---END_PAGE---');
    const pageContent = endIndex > 0 ? block.slice(0, endIndex) : block;

    // Parse metadata
    const nameMatch = pageContent.match(/name:\s*(.+)/);
    const statusMatch = pageContent.match(/status:\s*(.+)/);
    const sourcesMatch = pageContent.match(/sources:\s*(.+)/);
    const contentMatch = pageContent.match(/content:\s*([\s\S]+)/);

    if (nameMatch && contentMatch) {
      const name = nameMatch[1].trim();
      const status = statusMatch ? statusMatch[1].trim() : 'seedling';
      const sourcesRaw = sourcesMatch ? sourcesMatch[1].trim() : defaultSource;
      const content = contentMatch[1].trim();

      // Parse sources (can be comma-separated)
      const sources = sourcesRaw
        .split(',')
        .map((s) => s.trim())
        .filter((s) => s.length > 0);

      // Extract title from content (first # heading)
      const titleMatch = content.match(/^#\s+(.+)/m);
      const title = titleMatch ? titleMatch[1].trim() : name;

      pages.push({
        name,
        title,
        status,
        sources,
        content,
      });
    }
  }

  return pages;
}

/**
 * Create a new wiki page with frontmatter
 */
function createWikiPage(
  title: string,
  status: string,
  sources: string[],
  content: string
): string {
  const today = new Date().toISOString().split('T')[0];
  const sourcesYaml = sources.map((s) => `  - ${s}`).join('\n');

  return `---
title: ${title}
status: ${status}
sources:
${sourcesYaml}
last_updated: ${today}
---

${content}
`;
}

/**
 * Merge new content into existing wiki page
 */
async function mergeWikiPage(
  existingContent: string,
  newContent: string,
  newSources: string[]
): Promise<string> {
  const today = new Date().toISOString().split('T')[0];

  // Parse existing frontmatter
  const frontmatterMatch = existingContent.match(/^---\n([\s\S]+?)\n---/);

  if (!frontmatterMatch) {
    // No frontmatter, just append new content
    return `${existingContent}\n\n## Updated ${today}\n\n${newContent}`;
  }

  const frontmatter = frontmatterMatch[1];
  const bodyContent = existingContent.slice(frontmatterMatch[0].length);

  // Parse existing sources
  const sourcesMatch = frontmatter.match(/sources:\s*([\s\S]+?)(?=\n\w+:|$)/);
  const existingSources: string[] = [];

  if (sourcesMatch) {
    const sourcesBlock = sourcesMatch[1];
    const sourceLines = sourcesBlock.split('\n').filter((line) => line.trim().startsWith('- '));
    existingSources.push(...sourceLines.map((line) => line.replace(/^\s*-\s*/, '').trim()));
  }

  // Merge sources (deduplicate)
  const allSources = [...new Set([...existingSources, ...newSources])];
  const sourcesYaml = allSources.map((s) => `  - ${s}`).join('\n');

  // Update frontmatter
  let updatedFrontmatter = frontmatter;
  updatedFrontmatter = updatedFrontmatter.replace(
    /sources:\s*[\s\S]+?(?=\n\w+:|$)/,
    `sources:\n${sourcesYaml}`
  );
  updatedFrontmatter = updatedFrontmatter.replace(
    /last_updated:\s*.+/,
    `last_updated: ${today}`
  );

  // Append new content under "Updated" heading
  return `---
${updatedFrontmatter}
---
${bodyContent}

## Updated ${today}

${newContent}
`;
}

/**
 * Update index.md with new/updated pages
 */
async function updateIndex(
  wikiDir: string,
  pages: Array<{ name: string; title: string; sources: string[] }>
): Promise<void> {
  const indexPath = path.join(wikiDir, 'index.md');

  // Read existing index
  let indexContent = await fs.readFile(indexPath, 'utf-8');

  // Parse existing entries
  const entries = new Map<string, string>();
  const lines = indexContent.split('\n');

  for (const line of lines) {
    const match = line.match(/^-\s+\[\[(.+?)\]\]\s+—\s+(.+)\s+\(sources:\s+(\d+)\)/);
    if (match) {
      const pageName = match[1];
      entries.set(pageName, line);
    }
  }

  // Add/update entries for new pages
  for (const page of pages) {
    const summary = `Brief summary of ${page.title}.`;
    const sourceCount = page.sources.length;
    const entry = `- [[${page.name}]] — ${summary} (sources: ${sourceCount})`;
    entries.set(page.name, entry);
  }

  // Rebuild index
  const sortedEntries = Array.from(entries.values()).sort();
  const newIndex = `# Wiki Index\n\n${sortedEntries.join('\n')}\n`;

  await fs.writeFile(indexPath, newIndex, 'utf-8');
}

/**
 * Reads and parses index.md. Returns array of WikiPage stubs (name + summary only).
 */
export async function readIndex(wikiDir: string): Promise<WikiPage[]> {
  const indexPath = path.join(wikiDir, 'index.md');

  try {
    const content = await fs.readFile(indexPath, 'utf-8');
    const pages: WikiPage[] = [];
    const lines = content.split('\n');

    for (const line of lines) {
      const match = line.match(/^-\s+\[\[(.+?)\]\]\s+—\s+(.+)\s+\(sources:\s+(\d+)\)/);
      if (match) {
        const name = match[1];
        const summary = match[2];
        const sourceCount = parseInt(match[3], 10);

        pages.push({
          name,
          path: path.join(wikiDir, `${name}.md`),
          title: name,
          status: 'unknown',
          sources: Array(sourceCount).fill(''),
          lastUpdated: '',
          summary,
        });
      }
    }

    return pages;
  } catch (error) {
    // Index doesn't exist or can't be read
    return [];
  }
}

/**
 * Lists ALL wiki pages by scanning Wiki/*.md (excluding SCHEMA.md, index.md, log.md).
 * Returns full WikiPage objects parsed from frontmatter.
 */
export async function listPages(wikiDir: string): Promise<WikiPage[]> {
  const pages: WikiPage[] = [];

  try {
    const files = await fs.readdir(wikiDir);

    for (const file of files) {
      // Skip special files
      if (file === 'SCHEMA.md' || file === 'index.md' || file === 'log.md') {
        continue;
      }

      // Only process .md files
      if (!file.endsWith('.md')) {
        continue;
      }

      const filePath = path.join(wikiDir, file);
      const content = await fs.readFile(filePath, 'utf-8');

      // Parse frontmatter
      const frontmatterMatch = content.match(/^---\n([\s\S]+?)\n---/);

      if (!frontmatterMatch) {
        // No frontmatter, skip
        continue;
      }

      const frontmatter = frontmatterMatch[1];

      // Extract fields
      const titleMatch = frontmatter.match(/title:\s*(.+)/);
      const statusMatch = frontmatter.match(/status:\s*(.+)/);
      const lastUpdatedMatch = frontmatter.match(/last_updated:\s*(.+)/);
      const sourcesMatch = frontmatter.match(/sources:\s*([\s\S]+?)(?=\n\w+:|$)/);

      const name = file.replace('.md', '');
      const title = titleMatch ? titleMatch[1].trim() : name;
      const status = statusMatch ? statusMatch[1].trim() : 'unknown';
      const lastUpdated = lastUpdatedMatch ? lastUpdatedMatch[1].trim() : '';

      // Parse sources
      const sources: string[] = [];
      if (sourcesMatch) {
        const sourcesBlock = sourcesMatch[1];
        const sourceLines = sourcesBlock.split('\n').filter((line) => line.trim().startsWith('- '));
        sources.push(...sourceLines.map((line) => line.replace(/^\s*-\s*/, '').trim()));
      }

      pages.push({
        name,
        path: filePath,
        title,
        status,
        sources,
        lastUpdated,
        summary: '', // Not available in full page scan
      });
    }

    return pages;
  } catch (error) {
    // Directory doesn't exist or can't be read
    return [];
  }
}

/**
 * Appends an entry to log.md.
 */
export async function appendLog(
  wikiDir: string,
  operation: string,
  detail: string
): Promise<void> {
  const logPath = path.join(wikiDir, 'log.md');

  const now = new Date();
  const timestamp = now.toISOString().replace('T', ' ').slice(0, 16);
  const logEntry = `\n## [${timestamp}] ${operation} | Source: ${detail}\n`;

  try {
    await fs.appendFile(logPath, logEntry, 'utf-8');
  } catch (error) {
    console.error('Failed to append to log:', error);
  }
}
