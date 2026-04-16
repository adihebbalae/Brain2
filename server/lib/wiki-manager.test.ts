/**
 * Tests for wiki-manager.ts
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import * as os from 'node:os';
import {
  ensureWikiExists,
  ingestSource,
  readIndex,
  listPages,
  appendLog,
} from './wiki-manager';

// Mock ollama-client
vi.mock('./ollama-client.js', () => ({
  getOllamaStatus: vi.fn(),
}));

// Mock vault-config
vi.mock('./vault-config.js', () => ({
  isPathInVault: vi.fn(),
  getPrimaryVaultDir: vi.fn(),
}));

import { getOllamaStatus } from './ollama-client';
import { isPathInVault } from './vault-config';

describe('wiki-manager', () => {
  let testDir: string;
  let wikiDir: string;
  let sourceFile: string;

  beforeEach(async () => {
    // Create temporary directory
    testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'wiki-test-'));
    wikiDir = path.join(testDir, 'Wiki');
    sourceFile = path.join(testDir, 'source.md');

    // Reset mocks
    vi.clearAllMocks();

    // Default mock implementations
    vi.mocked(isPathInVault).mockResolvedValue(true);
  });

  afterEach(async () => {
    // Clean up test directory
    try {
      await fs.rm(testDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe('ensureWikiExists', () => {
    it('should create Wiki/ directory and SCHEMA.md on first call', async () => {
      await ensureWikiExists(wikiDir);

      // Check Wiki directory exists
      const stat = await fs.stat(wikiDir);
      expect(stat.isDirectory()).toBe(true);

      // Check SCHEMA.md exists
      const schemaPath = path.join(wikiDir, 'SCHEMA.md');
      const schemaContent = await fs.readFile(schemaPath, 'utf-8');
      expect(schemaContent).toContain('# Cortex Wiki Schema');
      expect(schemaContent).toContain('Based on Karpathy');

      // Check index.md exists
      const indexPath = path.join(wikiDir, 'index.md');
      const indexContent = await fs.readFile(indexPath, 'utf-8');
      expect(indexContent).toContain('# Wiki Index');

      // Check log.md exists
      const logPath = path.join(wikiDir, 'log.md');
      const logContent = await fs.readFile(logPath, 'utf-8');
      expect(logContent).toContain('# Wiki Log');
    });

    it('should be no-op on subsequent calls', async () => {
      // First call
      await ensureWikiExists(wikiDir);

      // Modify SCHEMA.md
      const schemaPath = path.join(wikiDir, 'SCHEMA.md');
      await fs.writeFile(schemaPath, '# Modified', 'utf-8');

      // Second call
      await ensureWikiExists(wikiDir);

      // Check SCHEMA.md was not overwritten
      const schemaContent = await fs.readFile(schemaPath, 'utf-8');
      expect(schemaContent).toBe('# Modified');
    });

    it('should create missing files without overwriting existing ones', async () => {
      // Create Wiki directory manually
      await fs.mkdir(wikiDir, { recursive: true });

      // Create only index.md
      const indexPath = path.join(wikiDir, 'index.md');
      await fs.writeFile(indexPath, '# Custom Index', 'utf-8');

      // Call ensureWikiExists
      await ensureWikiExists(wikiDir);

      // Check index.md was not overwritten
      const indexContent = await fs.readFile(indexPath, 'utf-8');
      expect(indexContent).toBe('# Custom Index');

      // Check SCHEMA.md was created
      const schemaPath = path.join(wikiDir, 'SCHEMA.md');
      const schemaContent = await fs.readFile(schemaPath, 'utf-8');
      expect(schemaContent).toContain('# Cortex Wiki Schema');

      // Check log.md was created
      const logPath = path.join(wikiDir, 'log.md');
      const logContent = await fs.readFile(logPath, 'utf-8');
      expect(logContent).toContain('# Wiki Log');
    });
  });

  describe('ingestSource', () => {
    it('should return error when source path is not in vault', async () => {
      vi.mocked(isPathInVault).mockResolvedValue(false);

      const result = await ingestSource(sourceFile, wikiDir);

      expect(result.pagesCreated).toEqual([]);
      expect(result.pagesUpdated).toEqual([]);
      expect(result.error).toContain('must be inside a configured vault');
    });

    it('should return error when Ollama is unavailable', async () => {
      // Create source file
      await fs.writeFile(sourceFile, '# Test Source\n\nSome content.', 'utf-8');

      // Mock Ollama unavailable
      vi.mocked(getOllamaStatus).mockResolvedValue({
        available: false,
        model: 'llama3.1:8b',
        url: 'http://localhost:11434',
      });

      const result = await ingestSource(sourceFile, wikiDir);

      expect(result.pagesCreated).toEqual([]);
      expect(result.pagesUpdated).toEqual([]);
      expect(result.error).toBe('Ollama unavailable');
    });

    it('should return error when source file does not exist', async () => {
      vi.mocked(getOllamaStatus).mockResolvedValue({
        available: true,
        model: 'llama3.1:8b',
        url: 'http://localhost:11434',
      });

      const result = await ingestSource('/nonexistent/file.md', wikiDir);

      expect(result.pagesCreated).toEqual([]);
      expect(result.pagesUpdated).toEqual([]);
      expect(result.error).toContain('Failed to read source file');
    });

    it('should parse Ollama response and create wiki pages', async () => {
      // Create source file
      await fs.writeFile(sourceFile, '# Test Source\n\nSome content about React and TypeScript.', 'utf-8');

      // Mock Ollama available
      vi.mocked(getOllamaStatus).mockResolvedValue({
        available: true,
        model: 'llama3.1:8b',
        url: 'http://localhost:11434',
      });

      // Mock fetch for Ollama API
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          response: `---WIKI_PAGE---
name: React
status: seedling
sources: source.md
content:
# React

React is a JavaScript library for building user interfaces. It uses a component-based architecture and virtual DOM for efficient rendering.

Related: [[TypeScript]], [[JavaScript]]

---END_PAGE---

---WIKI_PAGE---
name: TypeScript
status: seedling
sources: source.md
content:
# TypeScript

TypeScript is a superset of JavaScript that adds static typing. It helps catch errors at compile time.

Related: [[React]], [[JavaScript]]

---END_PAGE---`,
        }),
      });

      const result = await ingestSource(sourceFile, wikiDir);

      expect(result.pagesCreated).toEqual(['React', 'TypeScript']);
      expect(result.pagesUpdated).toEqual([]);
      expect(result.error).toBeUndefined();

      // Check React page was created
      const reactPath = path.join(wikiDir, 'React.md');
      const reactContent = await fs.readFile(reactPath, 'utf-8');
      expect(reactContent).toContain('title: React');
      expect(reactContent).toContain('status: seedling');
      expect(reactContent).toContain('sources:');
      expect(reactContent).toContain('- source.md');
      expect(reactContent).toContain('# React');
      expect(reactContent).toContain('JavaScript library');

      // Check TypeScript page was created
      const tsPath = path.join(wikiDir, 'TypeScript.md');
      const tsContent = await fs.readFile(tsPath, 'utf-8');
      expect(tsContent).toContain('title: TypeScript');
      expect(tsContent).toContain('# TypeScript');
    });

    it('should update existing page by merging content', async () => {
      // Create source file
      await fs.writeFile(sourceFile, '# Updated Source\n\nNew information about React.', 'utf-8');

      // Create existing React page
      await fs.mkdir(wikiDir, { recursive: true });
      const reactPath = path.join(wikiDir, 'React.md');
      const existingContent = `---
title: React
status: seedling
sources:
  - old-source.md
last_updated: 2026-01-01
---

# React

Original content about React.
`;
      await fs.writeFile(reactPath, existingContent, 'utf-8');

      // Create index.md
      const indexPath = path.join(wikiDir, 'index.md');
      await fs.writeFile(indexPath, '# Wiki Index\n\n- [[React]] — React library. (sources: 1)\n', 'utf-8');

      // Create log.md
      const logPath = path.join(wikiDir, 'log.md');
      await fs.writeFile(logPath, '# Wiki Log\n\n', 'utf-8');

      // Mock Ollama
      vi.mocked(getOllamaStatus).mockResolvedValue({
        available: true,
        model: 'llama3.1:8b',
        url: 'http://localhost:11434',
      });

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          response: `---WIKI_PAGE---
name: React
status: seedling
sources: source.md
content:
# React

Updated information about React hooks and concurrent features.

---END_PAGE---`,
        }),
      });

      const result = await ingestSource(sourceFile, wikiDir);

      expect(result.pagesCreated).toEqual([]);
      expect(result.pagesUpdated).toEqual(['React']);
      expect(result.error).toBeUndefined();

      // Check React page was updated (not replaced)
      const updatedContent = await fs.readFile(reactPath, 'utf-8');
      expect(updatedContent).toContain('Original content about React'); // Old content preserved
      expect(updatedContent).toContain('Updated information about React hooks'); // New content added
      expect(updatedContent).toContain('## Updated 2026'); // Update heading added
      expect(updatedContent).toContain('- old-source.md'); // Old source preserved
      expect(updatedContent).toContain('- source.md'); // New source added
    });

    it('should return error when Ollama returns empty response', async () => {
      await fs.writeFile(sourceFile, '# Test', 'utf-8');

      vi.mocked(getOllamaStatus).mockResolvedValue({
        available: true,
        model: 'llama3.1:8b',
        url: 'http://localhost:11434',
      });

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          response: '',
        }),
      });

      const result = await ingestSource(sourceFile, wikiDir);

      expect(result.error).toBe('Ollama returned empty response');
    });

    it('should return error when no wiki pages extracted', async () => {
      await fs.writeFile(sourceFile, '# Test', 'utf-8');

      vi.mocked(getOllamaStatus).mockResolvedValue({
        available: true,
        model: 'llama3.1:8b',
        url: 'http://localhost:11434',
      });

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          response: 'No valid wiki pages here',
        }),
      });

      const result = await ingestSource(sourceFile, wikiDir);

      expect(result.error).toBe('No wiki pages extracted from Ollama response');
    });

    it('should update index.md after ingest', async () => {
      await fs.writeFile(sourceFile, '# Test Source', 'utf-8');

      vi.mocked(getOllamaStatus).mockResolvedValue({
        available: true,
        model: 'llama3.1:8b',
        url: 'http://localhost:11434',
      });

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          response: `---WIKI_PAGE---
name: TestPage
status: seedling
sources: source.md
content:
# TestPage

Test content.

---END_PAGE---`,
        }),
      });

      await ingestSource(sourceFile, wikiDir);

      // Check index.md was updated
      const indexPath = path.join(wikiDir, 'index.md');
      const indexContent = await fs.readFile(indexPath, 'utf-8');
      expect(indexContent).toContain('[[TestPage]]');
      expect(indexContent).toContain('(sources: 1)');
    });

    it('should append to log.md after ingest', async () => {
      await fs.writeFile(sourceFile, '# Test Source', 'utf-8');

      vi.mocked(getOllamaStatus).mockResolvedValue({
        available: true,
        model: 'llama3.1:8b',
        url: 'http://localhost:11434',
      });

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          response: `---WIKI_PAGE---
name: TestPage
status: seedling
sources: source.md
content:
# TestPage

Test content.

---END_PAGE---`,
        }),
      });

      await ingestSource(sourceFile, wikiDir);

      // Check log.md was updated
      const logPath = path.join(wikiDir, 'log.md');
      const logContent = await fs.readFile(logPath, 'utf-8');
      expect(logContent).toContain('ingest');
      expect(logContent).toContain('source.md');
      expect(logContent).toContain('Created 1 pages');
    });
  });

  describe('readIndex', () => {
    it('should parse index.md and return page stubs', async () => {
      await fs.mkdir(wikiDir, { recursive: true });
      const indexPath = path.join(wikiDir, 'index.md');
      const indexContent = `# Wiki Index

- [[React]] — JavaScript library for UI. (sources: 2)
- [[TypeScript]] — Typed superset of JavaScript. (sources: 1)
- [[Node.js]] — JavaScript runtime. (sources: 3)
`;
      await fs.writeFile(indexPath, indexContent, 'utf-8');

      const pages = await readIndex(wikiDir);

      expect(pages).toHaveLength(3);
      expect(pages[0].name).toBe('React');
      expect(pages[0].summary).toBe('JavaScript library for UI.');
      expect(pages[0].sources).toHaveLength(2);
      expect(pages[1].name).toBe('TypeScript');
      expect(pages[1].summary).toBe('Typed superset of JavaScript.');
      expect(pages[2].name).toBe('Node.js');
    });

    it('should return empty array when index.md does not exist', async () => {
      const pages = await readIndex(wikiDir);

      expect(pages).toEqual([]);
    });

    it('should skip lines that do not match the format', async () => {
      await fs.mkdir(wikiDir, { recursive: true });
      const indexPath = path.join(wikiDir, 'index.md');
      const indexContent = `# Wiki Index

This is some text.

- [[React]] — JavaScript library. (sources: 1)
- Invalid line without wikilink
- [[TypeScript]] — Typed JavaScript. (sources: 2)

More text here.
`;
      await fs.writeFile(indexPath, indexContent, 'utf-8');

      const pages = await readIndex(wikiDir);

      expect(pages).toHaveLength(2);
      expect(pages[0].name).toBe('React');
      expect(pages[1].name).toBe('TypeScript');
    });
  });

  describe('listPages', () => {
    it('should list all wiki pages with frontmatter', async () => {
      await fs.mkdir(wikiDir, { recursive: true });

      // Create React.md
      const reactContent = `---
title: React Library
status: developing
sources:
  - source1.md
  - source2.md
last_updated: 2026-04-01
---

# React Library

Content here.
`;
      await fs.writeFile(path.join(wikiDir, 'React.md'), reactContent, 'utf-8');

      // Create TypeScript.md
      const tsContent = `---
title: TypeScript
status: seedling
sources:
  - source3.md
last_updated: 2026-04-02
---

# TypeScript

Content here.
`;
      await fs.writeFile(path.join(wikiDir, 'TypeScript.md'), tsContent, 'utf-8');

      const pages = await listPages(wikiDir);

      expect(pages).toHaveLength(2);

      const reactPage = pages.find((p) => p.name === 'React');
      expect(reactPage).toBeDefined();
      expect(reactPage!.title).toBe('React Library');
      expect(reactPage!.status).toBe('developing');
      expect(reactPage!.sources).toEqual(['source1.md', 'source2.md']);
      expect(reactPage!.lastUpdated).toBe('2026-04-01');

      const tsPage = pages.find((p) => p.name === 'TypeScript');
      expect(tsPage).toBeDefined();
      expect(tsPage!.title).toBe('TypeScript');
      expect(tsPage!.status).toBe('seedling');
    });

    it('should skip SCHEMA.md, index.md, and log.md', async () => {
      await fs.mkdir(wikiDir, { recursive: true });

      // Create special files
      await fs.writeFile(path.join(wikiDir, 'SCHEMA.md'), '# Schema', 'utf-8');
      await fs.writeFile(path.join(wikiDir, 'index.md'), '# Index', 'utf-8');
      await fs.writeFile(path.join(wikiDir, 'log.md'), '# Log', 'utf-8');

      // Create regular page
      const pageContent = `---
title: Regular Page
status: seedling
sources:
  - source.md
last_updated: 2026-04-01
---

# Regular Page
`;
      await fs.writeFile(path.join(wikiDir, 'RegularPage.md'), pageContent, 'utf-8');

      const pages = await listPages(wikiDir);

      expect(pages).toHaveLength(1);
      expect(pages[0].name).toBe('RegularPage');
    });

    it('should skip files without frontmatter', async () => {
      await fs.mkdir(wikiDir, { recursive: true });

      // Create page without frontmatter
      await fs.writeFile(path.join(wikiDir, 'NoFrontmatter.md'), '# No Frontmatter\n\nContent.', 'utf-8');

      // Create page with frontmatter
      const pageContent = `---
title: With Frontmatter
status: seedling
sources:
  - source.md
last_updated: 2026-04-01
---

# With Frontmatter
`;
      await fs.writeFile(path.join(wikiDir, 'WithFrontmatter.md'), pageContent, 'utf-8');

      const pages = await listPages(wikiDir);

      expect(pages).toHaveLength(1);
      expect(pages[0].name).toBe('WithFrontmatter');
    });

    it('should return empty array when wiki directory does not exist', async () => {
      const pages = await listPages(wikiDir);

      expect(pages).toEqual([]);
    });

    it('should skip non-.md files', async () => {
      await fs.mkdir(wikiDir, { recursive: true });

      // Create non-markdown file
      await fs.writeFile(path.join(wikiDir, 'notes.txt'), 'Text file', 'utf-8');

      // Create markdown file
      const pageContent = `---
title: Markdown Page
status: seedling
sources:
  - source.md
last_updated: 2026-04-01
---

# Markdown Page
`;
      await fs.writeFile(path.join(wikiDir, 'MarkdownPage.md'), pageContent, 'utf-8');

      const pages = await listPages(wikiDir);

      expect(pages).toHaveLength(1);
      expect(pages[0].name).toBe('MarkdownPage');
    });
  });

  describe('appendLog', () => {
    it('should append entry to log.md with correct format', async () => {
      await fs.mkdir(wikiDir, { recursive: true });
      const logPath = path.join(wikiDir, 'log.md');
      await fs.writeFile(logPath, '# Wiki Log\n\n', 'utf-8');

      await appendLog(wikiDir, 'ingest', 'Created 2 pages from test.md');

      const logContent = await fs.readFile(logPath, 'utf-8');
      expect(logContent).toContain('# Wiki Log');
      expect(logContent).toContain('## [');
      expect(logContent).toContain('] ingest | Source: Created 2 pages from test.md');
    });

    it('should append multiple entries preserving order', async () => {
      await fs.mkdir(wikiDir, { recursive: true });
      const logPath = path.join(wikiDir, 'log.md');
      await fs.writeFile(logPath, '# Wiki Log\n\n', 'utf-8');

      await appendLog(wikiDir, 'ingest', 'First entry');
      await appendLog(wikiDir, 'ingest', 'Second entry');
      await appendLog(wikiDir, 'query', 'Third entry');

      const logContent = await fs.readFile(logPath, 'utf-8');
      const firstIndex = logContent.indexOf('First entry');
      const secondIndex = logContent.indexOf('Second entry');
      const thirdIndex = logContent.indexOf('Third entry');

      expect(firstIndex).toBeGreaterThan(-1);
      expect(secondIndex).toBeGreaterThan(firstIndex);
      expect(thirdIndex).toBeGreaterThan(secondIndex);
    });

    it('should handle non-existent log file gracefully', async () => {
      // Don't create log.md, let appendLog handle it
      await fs.mkdir(wikiDir, { recursive: true });

      // This should not throw
      await expect(appendLog(wikiDir, 'ingest', 'Test')).resolves.toBeUndefined();
    });
  });
});
