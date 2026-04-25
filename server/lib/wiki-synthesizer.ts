import path from 'node:path';
import { promises as fs } from 'node:fs';
import { appendLog, ensureWikiExists, listPages, type WikiPage } from './wiki-manager.js';
import { getOllamaStatus } from './ollama-client.js';

const OLLAMA_URL = process.env.OLLAMA_URL || 'http://localhost:11434';
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'llama3.1:8b';
const SYNTHESIS_PAGES = [
  { name: 'self-overview', title: 'Self / Overview' },
  { name: 'self-timeline', title: 'Self / Timeline' },
  { name: 'self-autobiography', title: 'Self / Autobiography' },
] as const;

interface PageDocument extends WikiPage {
  body: string;
}

interface TimelineEntry {
  date: string;
  pageName: string;
  title: string;
  snippet: string;
}

export interface WikiSynthesisResult {
  pagesCreated: string[];
  pagesUpdated: string[];
  pageNames: string[];
  error?: string;
}

export async function synthesizeWikiProfile(wikiDir: string): Promise<WikiSynthesisResult> {
  await ensureWikiExists(wikiDir);

  const ollamaStatus = await getOllamaStatus();
  if (!ollamaStatus.available) {
    return {
      pagesCreated: [],
      pagesUpdated: [],
      pageNames: [],
      error: 'Ollama unavailable',
    };
  }

  const pages = await listPages(wikiDir);
  const sourcePages = pages.filter((page) => !SYNTHESIS_PAGES.some((candidate) => candidate.name === page.name) && page.name !== 'gaps');

  if (sourcePages.length === 0) {
    return {
      pagesCreated: [],
      pagesUpdated: [],
      pageNames: [],
      error: 'No source wiki pages available for synthesis',
    };
  }

  const documents = await Promise.all(sourcePages.map(async (page) => ({
    ...page,
    body: stripFrontmatter(await fs.readFile(page.path, 'utf-8')).trim(),
  })));

  const overviewEvidence = buildOverviewEvidence(documents);
  const autobiographyEvidence = buildAutobiographyEvidence(documents);
  const timelineBody = buildTimelinePage(documents);

  const [overviewBody, autobiographyBody] = await Promise.all([
    generateWithOllama(buildOverviewPrompt(overviewEvidence)),
    generateWithOllama(buildAutobiographyPrompt(autobiographyEvidence)),
  ]);

  const outputPages = [
    {
      name: 'self-overview',
      title: 'Self / Overview',
      status: 'developing',
      body: overviewBody,
      sources: documents.slice(0, 24).map((page) => `wiki:${page.name}.md`),
    },
    {
      name: 'self-timeline',
      title: 'Self / Timeline',
      status: 'developing',
      body: timelineBody,
      sources: documents.slice(0, 24).map((page) => `wiki:${page.name}.md`),
    },
    {
      name: 'self-autobiography',
      title: 'Self / Autobiography',
      status: 'developing',
      body: autobiographyBody,
      sources: documents.slice(0, 24).map((page) => `wiki:${page.name}.md`),
    },
  ];

  const existingPageNames = new Set(pages.map((page) => page.name));
  const pagesCreated: string[] = [];
  const pagesUpdated: string[] = [];

  for (const outputPage of outputPages) {
    const pagePath = path.join(wikiDir, `${outputPage.name}.md`);
    const content = createSynthesisPage(outputPage.title, outputPage.status, outputPage.sources, outputPage.body);
    await fs.writeFile(pagePath, content, 'utf-8');

    if (existingPageNames.has(outputPage.name)) {
      pagesUpdated.push(outputPage.name);
    } else {
      pagesCreated.push(outputPage.name);
    }
  }

  await rebuildIndex(wikiDir);
  await appendLog(wikiDir, 'synthesis', `Created ${pagesCreated.length} page(s), updated ${pagesUpdated.length} page(s)`);

  return {
    pagesCreated,
    pagesUpdated,
    pageNames: outputPages.map((page) => page.name),
  };
}

async function generateWithOllama(prompt: string): Promise<string> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 60000);

  try {
    const response = await fetch(`${OLLAMA_URL}/api/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: OLLAMA_MODEL,
        prompt,
        stream: false,
        options: {
          temperature: 0,
          seed: 7,
        },
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`Ollama API error: ${response.status}`);
    }

    const data = await response.json() as { response?: string };
    const result = data.response?.trim();
    if (!result) {
      throw new Error('Ollama returned empty response');
    }

    return result;
  } finally {
    clearTimeout(timeout);
  }
}

function createSynthesisPage(title: string, status: string, sources: string[], body: string): string {
  const today = new Date().toISOString().split('T')[0];
  const sourcesYaml = sources.map((source) => `  - ${source}`).join('\n');

  return `---
title: ${title}
status: ${status}
sources:
${sourcesYaml}
last_updated: ${today}
---

${body.trim()}
`;
}

function buildOverviewPrompt(evidence: string): string {
  return [
    'You are maintaining a personal wiki.',
    'Write the body of a markdown page titled "# Self / Overview".',
    'Use only the supplied evidence and do not invent facts.',
    'Use sections: "## Snapshot", "## Focus Areas", "## Systems", and "## Evidence Notes".',
    'Prefer short paragraphs and bullets. Use [[wikilinks]] when referring to source pages.',
    '',
    'Evidence:',
    evidence,
  ].join('\n');
}

function buildAutobiographyPrompt(evidence: string): string {
  return [
    'You are maintaining a personal wiki.',
    'Write the body of a markdown page titled "# Self / Autobiography".',
    'Write a grounded autobiographical sketch in first person, but only from the supplied evidence.',
    'If something is uncertain, say "The record suggests..." rather than asserting it.',
    'Use sections: "## Throughline", "## Current Chapter", and "## Questions In Motion".',
    'Use [[wikilinks]] when citing source pages.',
    '',
    'Evidence:',
    evidence,
  ].join('\n');
}

function buildOverviewEvidence(documents: PageDocument[]): string {
  const countsByKind = countBy(documents.map(inferDocumentKind));
  const highlights = documents
    .slice()
    .sort((left, right) => right.lastUpdated.localeCompare(left.lastUpdated))
    .slice(0, 20)
    .map((document) => `- [[${document.name}]] (${inferDocumentKind(document)}) :: ${summarizeBody(document.body)}`);

  const categorySummary = Array.from(countsByKind.entries())
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
    .map(([kind, count]) => `- ${kind}: ${count} page(s)`)
    .join('\n');

  return [
    'Source coverage:',
    categorySummary || '- (none)',
    '',
    'Recent page highlights:',
    highlights.join('\n'),
  ].join('\n');
}

function buildAutobiographyEvidence(documents: PageDocument[]): string {
  const themeCounts = countBy(documents.flatMap((document) => extractKeywords(`${document.title} ${document.body}`)).slice(0, 240));
  const topThemes = Array.from(themeCounts.entries())
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
    .slice(0, 16)
    .map(([theme, count]) => `- ${theme} (${count})`)
    .join('\n');

  const pageSummaries = documents
    .slice(0, 20)
    .map((document) => `- [[${document.name}]] :: ${summarizeBody(document.body)}`);

  return [
    'Recurring themes:',
    topThemes || '- (none)',
    '',
    'Grounding page summaries:',
    pageSummaries.join('\n'),
  ].join('\n');
}

function buildTimelinePage(documents: PageDocument[]): string {
  const entries = extractTimelineEntries(documents);
  const coverage = Array.from(countBy(documents.map(inferDocumentKind)).entries())
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]));

  const lines = [
    '# Self / Timeline',
    '',
    '## Chronological Highlights',
  ];

  if (entries.length === 0) {
    lines.push('- No dated evidence found yet in the imported wiki pages.');
  } else {
    for (const entry of entries.slice(0, 40)) {
      lines.push(`- ${entry.date} — [[${entry.pageName}]]: ${entry.snippet}`);
    }
  }

  lines.push('', '## Source Coverage');
  if (coverage.length === 0) {
    lines.push('- (none)');
  } else {
    for (const [kind, count] of coverage) {
      lines.push(`- ${kind}: ${count} page(s)`);
    }
  }

  return lines.join('\n');
}

function extractTimelineEntries(documents: PageDocument[]): TimelineEntry[] {
  const entries: TimelineEntry[] = [];
  const seen = new Set<string>();

  for (const document of documents) {
    const lines = document.body.split('\n').map((line) => line.trim()).filter(Boolean);
    for (const line of lines) {
      const match = line.match(/\b(20\d{2}-\d{2}-\d{2})\b/);
      if (!match) {
        continue;
      }

      const date = match[1];
      const snippet = line.replace(/\s+/g, ' ').slice(0, 180);
      const key = `${date}:${document.name}:${snippet}`;
      if (seen.has(key)) {
        continue;
      }

      seen.add(key);
      entries.push({
        date,
        pageName: document.name,
        title: document.title,
        snippet,
      });
    }
  }

  return entries.sort((left, right) => left.date.localeCompare(right.date) || left.pageName.localeCompare(right.pageName));
}

async function rebuildIndex(wikiDir: string): Promise<void> {
  const pages = await listPages(wikiDir);
  const entries: string[] = [];

  for (const page of pages) {
    const content = await fs.readFile(page.path, 'utf-8');
    const summary = summarizeBody(stripFrontmatter(content));
    entries.push(`- [[${page.name}]] -- ${summary} (sources: ${page.sources.length})`);
  }

  entries.sort((left, right) => left.localeCompare(right));
  await fs.writeFile(path.join(wikiDir, 'index.md'), `# Wiki Index\n\n${entries.join('\n')}\n`, 'utf-8');
}

function inferDocumentKind(document: PageDocument): string {
  const sourceText = document.sources.join(' ').toLowerCase();

  if (sourceText.includes('claude:')) return 'claude';
  if (sourceText.includes(':youtube')) return 'youtube';
  if (sourceText.includes(':chrome')) return 'chrome';
  if (sourceText.includes(':calendar')) return 'calendar';
  if (sourceText.includes(':discover')) return 'discover';
  if (sourceText.includes(':notebooklm:')) return 'notebooklm';
  return 'wiki';
}

function summarizeBody(body: string): string {
  const lines = body
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.startsWith('#'));

  return lines[0]?.slice(0, 160) || 'Wiki page.';
}

function stripFrontmatter(content: string): string {
  return content.replace(/^---\n[\s\S]+?\n---\s*/m, '');
}

function countBy(values: string[]): Map<string, number> {
  const counts = new Map<string, number>();

  for (const value of values) {
    const normalized = value.trim();
    if (!normalized) {
      continue;
    }

    counts.set(normalized, (counts.get(normalized) || 0) + 1);
  }

  return counts;
}

function extractKeywords(value: string): string[] {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((word) => word.length >= 5 && !STOPWORDS.has(word));
}

const STOPWORDS = new Set([
  'about', 'after', 'again', 'their', 'there', 'these', 'those', 'which', 'while', 'where',
  'would', 'could', 'should', 'through', 'because', 'imported', 'dataset', 'mirror', 'title',
  'summary', 'sources', 'updated', 'project', 'record', 'seems',
]);
