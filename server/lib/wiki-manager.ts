/**
 * LLM Wiki Manager
 * Based on Karpathy's LLM Wiki pattern (April 2026)
 * Manages wiki pages, index, and ingest operations
 */

import { promises as fs } from 'node:fs';
import path from 'node:path';
import { getOllamaStatus } from './ollama-client.js';
import { isPathInVault } from './vault-config.js';

const INDEX_ENTRY_SEPARATOR = '--';
const INDEX_ENTRY_PATTERN = /^-\s+\[\[(.+?)\]\]\s+(?:--|—|â€”|Ã¢â‚¬â€)\s+(.+)\s+\(sources:\s+(\d+)\)$/;

export interface WikiPage {
  name: string;           // filename without .md
  path: string;           // absolute path
  title: string;          // from frontmatter or filename
  status: string;         // seedling | developing | mature
  sources: string[];      // from frontmatter sources array
  lastUpdated: string;    // from frontmatter last_updated
  summary: string;        // from index.md one-liner
}

export interface WikiPageDetail extends WikiPage {
  content: string;
  backlinks: string[];
  outboundLinks: string[];
}

export interface IngestResult {
  pagesCreated: string[];
  pagesUpdated: string[];
  error?: string;
}

export interface QueryResult {
  answer: string;
  citations: string[];   // page names referenced in the answer
  error?: string;
}

export interface LintResult {
  orphans: string[];        // pages with no inbound [[links]] from other pages
  stale: string[];          // pages where source file is newer than wiki page mtime
  gaps: string[];           // [[links]] referenced in pages but no corresponding .md file
  healthScore: number;      // 0-100: 100 = perfect, -5 per orphan, -10 per stale, -10 per gap
}

export interface GapResource {
  title: string;
  url: string;
  type: 'article' | 'video' | 'unknown';
}

export interface KnowledgeGap {
  topic: string;
  reason: string;           // e.g. "Referenced 4x in active projects but no wiki page"
  priority: number;         // 1 (highest) to 5
  resources: GapResource[];
}

export interface GapAnalysisResult {
  gaps: KnowledgeGap[];
  generatedAt: string;      // ISO timestamp
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
  const isValid = await isPathInAllowedRoots(sourcePath);
  if (!isValid) {
    return {
      pagesCreated: [],
      pagesUpdated: [],
      error: 'Source path must be inside a configured vault or projects directory',
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
  const indexContent = await fs.readFile(indexPath, 'utf-8');

  // Parse existing entries
  const entries = new Map<string, string>();
  const lines = indexContent.split('\n');
  for (const line of lines) {
    const match = parseIndexEntry(line);
    if (match) {
      entries.set(match.name, line);
    }
  }

  // Add/update entries for new pages
  for (const page of pages) {
    const summary = `Brief summary of ${page.title}.`;
    const sourceCount = page.sources.length;
    const entry = `- [[${page.name}]] — ${summary} (sources: ${sourceCount})`;
    entries.set(page.name, entry.replace(/â€”|Ã¢â‚¬â€|—/g, INDEX_ENTRY_SEPARATOR));
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
      const match = parseIndexEntry(line);
      if (match) {
        pages.push({
          name: match.name,
          path: path.join(wikiDir, `${match.name}.md`),
          title: match.name,
          status: 'unknown',
          sources: Array(match.sourceCount).fill(''),
          lastUpdated: '',
          summary: match.summary,
        });
      }
    }

    if (pages.length === 0) {
      const fallbackPages = await listPages(wikiDir);
      return fallbackPages.map((page) => ({
        ...page,
        summary: '',
      }));
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

export async function readPage(
  wikiDir: string,
  pageName: string
): Promise<WikiPageDetail | null> {
  const normalizedName = pageName.trim();
  if (!normalizedName || normalizedName !== path.basename(normalizedName)) {
    return null;
  }

  const pages = await listPages(wikiDir);
  const page = pages.find((candidate) => candidate.name === normalizedName);
  if (!page) {
    return null;
  }

  const [rawContent, indexPages] = await Promise.all([
    fs.readFile(page.path, 'utf-8'),
    readIndex(wikiDir),
  ]);

  const body = stripFrontmatter(rawContent).trim();
  const outboundLinks = extractWikiLinks(body);
  const backlinks: string[] = [];

  for (const candidate of pages) {
    if (candidate.name === page.name) {
      continue;
    }

    try {
      const candidateContent = await fs.readFile(candidate.path, 'utf-8');
      if (candidateContent.includes(`[[${page.name}]]`)) {
        backlinks.push(candidate.name);
      }
    } catch {
      continue;
    }
  }

  const indexedSummary = indexPages.find((candidate) => candidate.name === page.name)?.summary;

  return {
    ...page,
    summary: indexedSummary || summarizeWikiBody(body),
    content: body,
    backlinks: Array.from(new Set(backlinks)).sort(),
    outboundLinks,
  };
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

async function isPathInAllowedRoots(filePath: string): Promise<boolean> {
  if (await isPathInVault(filePath)) {
    return true;
  }

  const projectsDir = process.env.PROJECTS_DIR?.trim();
  if (!projectsDir) {
    return false;
  }

  const resolvedPath = path.resolve(filePath);
  const resolvedProjectsDir = path.resolve(projectsDir);
  return resolvedPath.startsWith(resolvedProjectsDir + path.sep) || resolvedPath === resolvedProjectsDir;
}

function parseIndexEntry(line: string): { name: string; summary: string; sourceCount: number } | null {
  const match = line.match(INDEX_ENTRY_PATTERN);
  if (!match) {
    return null;
  }

  return {
    name: match[1],
    summary: match[2],
    sourceCount: Number.parseInt(match[3], 10),
  };
}

function stripFrontmatter(content: string): string {
  return content.replace(/^---\n[\s\S]+?\n---\s*/m, '');
}

function summarizeWikiBody(body: string): string {
  const lines = body
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.startsWith('#'));

  return lines[0]?.slice(0, 140) || 'Wiki page.';
}

function extractWikiLinks(content: string): string[] {
  const links = Array.from(content.matchAll(/\[\[(.+?)\]\]/g))
    .map((match) => match[1]?.trim())
    .filter((value): value is string => Boolean(value));

  return Array.from(new Set(links)).sort();
}

/**
 * Query the wiki using Ollama.
 * Finds relevant pages based on keyword matching, sends to Ollama, and returns answer with citations.
 */
export async function queryWiki(
  question: string,
  wikiDir: string
): Promise<QueryResult> {
  // Check if wiki exists (index.md must exist)
  const indexPath = path.join(wikiDir, 'index.md');
  try {
    await fs.access(indexPath);
  } catch {
    return {
      answer: '',
      citations: [],
      error: 'Wiki not initialized',
    };
  }

  // Check if Ollama is available
  const ollamaStatus = await getOllamaStatus();
  if (!ollamaStatus.available) {
    return {
      answer: '',
      citations: [],
      error: 'Ollama unavailable',
    };
  }

  // Read index to get page catalog
  const indexPages = await readIndex(wikiDir);

  // Find relevant pages: keyword match
  // Split question into words >= 4 chars, strip punctuation
  const keywords = question
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '') // Remove punctuation
    .split(/\s+/)
    .filter((word) => word.length >= 4);

  // Score pages based on keyword matches in name or summary
  const scoredPages = indexPages
    .map((page) => {
      const nameText = page.name.toLowerCase();
      const summaryText = page.summary.toLowerCase();
      let score = 0;

      for (const keyword of keywords) {
        if (nameText.includes(keyword)) score += 2;
        if (summaryText.includes(keyword)) score += 1;
      }

      return { page, score };
    })
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 5); // Top 5

  // Read content of relevant pages
  const relevantPages: Array<{ name: string; content: string }> = [];
  for (const { page } of scoredPages) {
    try {
      const content = await fs.readFile(page.path, 'utf-8');
      relevantPages.push({ name: page.name, content });
    } catch (error) {
      console.error(`Failed to read page ${page.name}:`, error);
    }
  }

  if (relevantPages.length === 0) {
    return {
      answer: 'No relevant pages found to answer this question.',
      citations: [],
    };
  }

  // Build Ollama prompt
  const pagesText = relevantPages
    .map((p) => `[[${p.name}]]:\n${p.content}`)
    .join('\n\n---\n\n');

  const prompt = `You are answering a question using a personal wiki. Use only the provided wiki pages.
Cite pages by name using [[PageName]] format.

Wiki pages:
${pagesText}

---

Question: ${question}

Answer concisely (2-4 sentences) with [[citations]]:`;

  // Call Ollama
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000); // 30 second timeout

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
        answer: '',
        citations: [],
        error: `Ollama API error: ${response.status}`,
      };
    }

    const data = await response.json();
    const answer = data.response?.trim() || '';

    if (!answer) {
      return {
        answer: '',
        citations: [],
        error: 'Ollama returned empty response',
      };
    }

    // Parse [[PageName]] citations from response
    const citationMatches = answer.matchAll(/\[\[(.+?)\]\]/g);
    const citationList: string[] = [];
    for (const match of citationMatches) {
      if (match[1]) {
        citationList.push(match[1]);
      }
    }
    const citations = Array.from(new Set(citationList));

    // Append to log
    const questionPreview = question.slice(0, 50);
    await appendLog(wikiDir, 'query', questionPreview);

    return {
      answer,
      citations,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return {
      answer: '',
      citations: [],
      error: `Failed to call Ollama: ${message}`,
    };
  }
}

/**
 * Lint the wiki to find orphans, stale pages, and gaps.
 * Returns a health score (0-100).
 */
export async function lintWiki(wikiDir: string): Promise<LintResult> {
  // List all wiki pages
  const pages = await listPages(wikiDir);

  if (pages.length === 0) {
    return {
      orphans: [],
      stale: [],
      gaps: [],
      healthScore: 100,
    };
  }

  const orphans: string[] = [];
  const stale: string[] = [];
  const gaps: string[] = [];

  // Build inbound link map
  const inboundLinks = new Map<string, Set<string>>();
  const allWikiLinks = new Set<string>();

  // Initialize map
  for (const page of pages) {
    inboundLinks.set(page.name, new Set());
  }

  // Read each page's content and extract [[wikilinks]]
  for (const page of pages) {
    try {
      const content = await fs.readFile(page.path, 'utf-8');
      const linkMatches = content.matchAll(/\[\[(.+?)\]\]/g);

      for (const match of linkMatches) {
        const linkedPageName = match[1];
        allWikiLinks.add(linkedPageName);

        // Add to inbound link map
        if (inboundLinks.has(linkedPageName)) {
          inboundLinks.get(linkedPageName)!.add(page.name);
        }
      }
    } catch (error) {
      console.error(`Failed to read page ${page.name} for link analysis:`, error);
    }
  }

  // Find orphans: pages with no inbound links (excluding index.md and log.md)
  for (const page of pages) {
    if (page.name === 'index' || page.name === 'log') continue;

    const inbound = inboundLinks.get(page.name);
    if (!inbound || inbound.size === 0) {
      orphans.push(page.name);
    }
  }

  // Find stale pages: source file newer than wiki page
  for (const page of pages) {
    try {
      const pageStats = await fs.stat(page.path);
      const pageMtime = pageStats.mtime.getTime();

      // Check each source
      for (const source of page.sources) {
        // Sources are relative paths - we need to resolve them
        // For now, we'll skip if we can't find the source
        // TODO: improve source path resolution
        try {
          const sourceStats = await fs.stat(source);
          const sourceMtime = sourceStats.mtime.getTime();

          if (sourceMtime > pageMtime) {
            stale.push(page.name);
            break; // Only add once per page
          }
        } catch {
          // Source file not found or inaccessible - skip
          continue;
        }
      }
    } catch (error) {
      console.error(`Failed to check staleness for ${page.name}:`, error);
    }
  }

  // Find gaps: [[links]] that don't have corresponding pages
  const existingPageNames = new Set(pages.map((p) => p.name));
  for (const link of allWikiLinks) {
    if (!existingPageNames.has(link) && link !== 'index' && link !== 'log') {
      gaps.push(link);
    }
  }

  // Calculate health score
  let healthScore = 100;
  healthScore -= orphans.length * 5;
  healthScore -= stale.length * 10;
  healthScore -= gaps.length * 10;
  healthScore = Math.max(0, healthScore);

  // Append to log
  const logDetail = `score: ${healthScore}, orphans: ${orphans.length}, stale: ${stale.length}, gaps: ${gaps.length}`;
  await appendLog(wikiDir, 'lint', logDetail);

  return {
    orphans,
    stale,
    gaps,
    healthScore,
  };
}

/**
 * Analyze knowledge gaps by finding topics referenced in projects but missing from wiki.
 * Fetches resource recommendations from DuckDuckGo for top gaps.
 * Writes results to gaps.md.
 */
export async function analyzeGaps(
  wikiDir: string,
  projectsDir: string
): Promise<GapAnalysisResult> {
  const now = new Date().toISOString();

  // Check if wiki exists
  try {
    await fs.access(path.join(wikiDir, 'index.md'));
  } catch {
    return {
      gaps: [],
      generatedAt: now,
      error: 'Wiki not initialized',
    };
  }

  // Step 1: Collect gap candidates

  // Import scanner dynamically
  const { scanProjects } = await import('./scanner.js');

  // Source A: from wiki lint
  const lintResult = await lintWiki(wikiDir);
  const existingPages = await listPages(wikiDir);
  const existingPageNames = new Set(existingPages.map(p => p.name));

  // Gap candidates from lint (referenced but missing pages)
  const gapCandidates = new Map<string, { topic: string; references: number }>();

  for (const gap of lintResult.gaps) {
    gapCandidates.set(gap.toLowerCase(), { topic: gap, references: 1 });
  }

  // Source B: from active project files
  try {
    const projects = await scanProjects(projectsDir);
    const activeProjects = projects.filter(p => p.status === 'in_progress');

    for (const project of activeProjects) {
      // Read the state file content to extract [[wikilinks]]
      try {
        const stateFileContent = await fs.readFile(project.stateFile, 'utf-8');
        const linkMatches = stateFileContent.matchAll(/\[\[(.+?)\]\]/g);

        for (const match of linkMatches) {
          const linkedTopic = match[1];
          const topicKey = linkedTopic.toLowerCase();

          // Check if this topic doesn't have a wiki page
          if (!existingPageNames.has(linkedTopic)) {
            if (gapCandidates.has(topicKey)) {
              gapCandidates.get(topicKey)!.references += 1;
            } else {
              gapCandidates.set(topicKey, { topic: linkedTopic, references: 1 });
            }
          }
        }
      } catch (error) {
        console.error(`Failed to read state file for gap analysis: ${project.stateFile}`, error);
      }
    }
  } catch (error) {
    console.error('Failed to scan projects for gap analysis:', error);
  }

  // Step 2: Score and rank gaps (more references = higher priority = lower number)
  const rankedGaps = Array.from(gapCandidates.values())
    .sort((a, b) => b.references - a.references)
    .slice(0, 10) // Top 10
    .map((item, index) => {
      // Convert to priority 1-5
      let priority = 1;
      if (index >= 2 && index < 5) priority = 2;
      else if (index >= 5 && index < 7) priority = 3;
      else if (index >= 7 && index < 9) priority = 4;
      else if (index >= 9) priority = 5;

      const reason = item.references === 1
        ? 'Referenced in active projects but no wiki page'
        : `Referenced ${item.references}x in active projects but no wiki page`;

      return {
        topic: item.topic,
        reason,
        priority,
        resources: [] as GapResource[],
      };
    });

  // Step 3: Fetch resources for top 5 gaps
  const top5 = rankedGaps.slice(0, 5);

  for (const gap of top5) {
    const resources = await fetchResourcesForTopic(gap.topic);
    gap.resources = resources;
    // Add delay between calls to respect rate limits
    await new Promise(resolve => setTimeout(resolve, 200));
  }

  // Step 4: Write gaps.md
  const gapsPath = path.join(wikiDir, 'gaps.md');
  const timestamp = new Date().toLocaleString('en-US', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });

  let gapsContent = `# Knowledge Gaps\n> Generated by Cortex on ${timestamp}\n\n## Priority Gaps\n\n`;

  for (const gap of rankedGaps) {
    gapsContent += `### ${gap.priority}. ${gap.topic}\n`;
    gapsContent += `**Reason**: ${gap.reason}\n`;

    if (gap.resources.length > 0) {
      gapsContent += `**Resources**:\n`;
      for (const resource of gap.resources) {
        const typeLabel = resource.type === 'video' ? 'video' : 'article';
        gapsContent += `- [${resource.title}](${resource.url}) — ${typeLabel}\n`;
      }
    } else {
      gapsContent += `**Resources**: None found\n`;
    }

    gapsContent += '\n';
  }

  try {
    await fs.writeFile(gapsPath, gapsContent, 'utf-8');
  } catch (error) {
    console.error('Failed to write gaps.md:', error);
  }

  // Step 5: Log the operation
  await appendLog(wikiDir, 'gaps', `Found ${rankedGaps.length} gaps`);

  return {
    gaps: rankedGaps,
    generatedAt: now,
  };
}

/**
 * Fetch resource recommendations from DuckDuckGo for a topic.
 * Returns up to 3 resources (articles and videos).
 */
async function fetchResourcesForTopic(topic: string): Promise<GapResource[]> {
  const resources: GapResource[] = [];

  try {
    // First call: general articles/tutorials
    const generalQuery = encodeURIComponent(`${topic} guide tutorial`);
    const generalUrl = `https://api.duckduckgo.com/?q=${generalQuery}&format=json&no_redirect=1&no_html=1&skip_disambig=1`;

    const generalResponse = await fetch(generalUrl, {
      signal: AbortSignal.timeout(5000),
    });

    if (generalResponse.ok) {
      const data = await generalResponse.json();

      if (data.RelatedTopics && Array.isArray(data.RelatedTopics)) {
        for (const item of data.RelatedTopics.slice(0, 2)) {
          if (item.FirstURL && item.Text) {
            const isVideo = item.FirstURL.includes('youtube.com');
            resources.push({
              title: item.Text.slice(0, 100), // Limit title length
              url: item.FirstURL,
              type: isVideo ? 'video' : 'article',
            });
          }
        }
      }
    }

    // Second call: YouTube-specific search
    const ytQuery = encodeURIComponent(`${topic} tutorial site:youtube.com`);
    const ytUrl = `https://api.duckduckgo.com/?q=${ytQuery}&format=json&no_redirect=1&no_html=1&skip_disambig=1`;

    const ytResponse = await fetch(ytUrl, {
      signal: AbortSignal.timeout(5000),
    });

    if (ytResponse.ok) {
      const data = await ytResponse.json();

      if (data.RelatedTopics && Array.isArray(data.RelatedTopics)) {
        for (const item of data.RelatedTopics.slice(0, 1)) {
          if (item.FirstURL && item.Text && item.FirstURL.includes('youtube.com')) {
            // Check if we already have this URL
            if (!resources.some(r => r.url === item.FirstURL)) {
              resources.push({
                title: item.Text.slice(0, 100),
                url: item.FirstURL,
                type: 'video',
              });
            }
          }
        }
      }
    }
  } catch (error) {
    // DuckDuckGo unavailable - return empty array, never throw
    console.error(`Failed to fetch resources for ${topic}:`, error);
  }

  return resources.slice(0, 3); // Max 3 resources per gap
}
