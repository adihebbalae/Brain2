import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { promises as fs } from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import {
  ensureWikiDir,
  parseIndex,
  listWikiPages,
  parseConcepts,
  extractWikiLinks,
  validateSourcePath,
} from './wiki-core.js'

let tmpDir: string

beforeEach(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'cortex-wiki-test-'))
})

afterEach(async () => {
  await fs.rm(tmpDir, { recursive: true, force: true })
})

describe('ensureWikiDir', () => {
  it('creates Wiki/ directory and SCHEMA.md on first call', async () => {
    const dir = await ensureWikiDir(tmpDir)
    expect(dir).toBe(path.join(tmpDir, 'Wiki'))

    const stat = await fs.stat(dir)
    expect(stat.isDirectory()).toBe(true)

    const schema = await fs.readFile(path.join(dir, 'SCHEMA.md'), 'utf-8')
    expect(schema).toContain('Wiki Schema')
    expect(schema).toContain('wikilinks')
  })

  it('does not overwrite SCHEMA.md on subsequent calls', async () => {
    await ensureWikiDir(tmpDir)
    const schemaPath = path.join(tmpDir, 'Wiki', 'SCHEMA.md')
    await fs.writeFile(schemaPath, 'custom content', 'utf-8')

    await ensureWikiDir(tmpDir) // second call
    const content = await fs.readFile(schemaPath, 'utf-8')
    expect(content).toBe('custom content')
  })
})

describe('parseIndex', () => {
  it('returns empty array when index.md does not exist', async () => {
    const pages = await parseIndex(tmpDir)
    expect(pages).toEqual([])
  })

  it('parses index entries correctly', async () => {
    await ensureWikiDir(tmpDir)
    const indexPath = path.join(tmpDir, 'Wiki', 'index.md')
    await fs.writeFile(indexPath, [
      '# Wiki Index',
      '',
      '- [[React Hooks]] — Custom hooks for state management (sources: 3, created: 2026-04-10)',
      '- [[TypeScript Generics]] — Advanced type patterns (sources: 1, created: 2026-04-12)',
      '',
    ].join('\n'), 'utf-8')

    const pages = await parseIndex(tmpDir)
    expect(pages).toHaveLength(2)
    expect(pages[0].name).toBe('React Hooks')
    expect(pages[0].summary).toBe('Custom hooks for state management')
    expect(pages[0].sourceCount).toBe(3)
    expect(pages[0].createdAt).toBe('2026-04-10')
    expect(pages[1].name).toBe('TypeScript Generics')
  })
})

describe('parseConcepts', () => {
  it('parses CONCEPT lines from Ollama response', () => {
    const text = `Here are the concepts:
CONCEPT: React Hooks | SUMMARY: Functions for state in components | CONTENT: React hooks like useState and useEffect allow functional components to manage state.
CONCEPT: TypeScript | SUMMARY: Typed JavaScript | CONTENT: TypeScript adds static types to JavaScript for better tooling and safety.`

    const concepts = parseConcepts(text)
    expect(concepts).toHaveLength(2)
    expect(concepts[0].name).toBe('React Hooks')
    expect(concepts[0].summary).toBe('Functions for state in components')
    expect(concepts[0].content).toContain('useState')
    expect(concepts[1].name).toBe('TypeScript')
  })

  it('returns empty array for text without CONCEPT lines', () => {
    const concepts = parseConcepts('Just some random text without any concepts.')
    expect(concepts).toEqual([])
  })
})

describe('extractWikiLinks', () => {
  it('extracts unique wikilinks from text', () => {
    const text = 'This uses [[React Hooks]] and [[TypeScript]], also see [[React Hooks]] again.'
    const links = extractWikiLinks(text)
    expect(links).toEqual(['React Hooks', 'TypeScript'])
  })

  it('returns empty array for text without wikilinks', () => {
    const links = extractWikiLinks('No links here.')
    expect(links).toEqual([])
  })
})

describe('validateSourcePath', () => {
  it('allows paths inside vault dir', () => {
    expect(validateSourcePath(
      path.join(tmpDir, 'notes', 'test.md'),
      tmpDir,
      path.join(tmpDir, 'projects')
    )).toBe(true)
  })

  it('allows paths inside projects dir', () => {
    const projectsDir = path.join(tmpDir, 'projects')
    expect(validateSourcePath(
      path.join(projectsDir, 'my-project', 'README.md'),
      tmpDir,
      projectsDir
    )).toBe(true)
  })

  it('rejects paths outside both dirs', () => {
    expect(validateSourcePath(
      path.resolve(tmpDir, '..', 'evil.md'),
      tmpDir,
      path.join(tmpDir, 'projects')
    )).toBe(false)
  })
})

describe('listWikiPages', () => {
  it('returns empty array when Wiki/ does not exist', async () => {
    const pages = await listWikiPages(tmpDir)
    expect(pages).toEqual([])
  })

  it('returns pages from index when available', async () => {
    await ensureWikiDir(tmpDir)
    const indexPath = path.join(tmpDir, 'Wiki', 'index.md')
    await fs.writeFile(indexPath, [
      '# Wiki Index',
      '',
      '- [[Test Page]] — A test page (sources: 1, created: 2026-04-14)',
      '',
    ].join('\n'), 'utf-8')

    const pages = await listWikiPages(tmpDir)
    expect(pages).toHaveLength(1)
    expect(pages[0].name).toBe('Test Page')
  })

  it('falls back to scanning files when index is empty', async () => {
    const wikiPath = path.join(tmpDir, 'Wiki')
    await fs.mkdir(wikiPath, { recursive: true })
    await fs.writeFile(path.join(wikiPath, 'index.md'), '# Wiki Index\n\n', 'utf-8')
    await fs.writeFile(path.join(wikiPath, 'Some-Concept.md'), '# Some Concept\n', 'utf-8')

    const pages = await listWikiPages(tmpDir)
    expect(pages).toHaveLength(1)
    expect(pages[0].name).toBe('Some Concept')
  })
})
