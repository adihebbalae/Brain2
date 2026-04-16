# Handoff: LLM Wiki core — schema, ingest, index, log
**Task ID**: TASK-016
**Mode**: autonomous (no user interaction available)

## Context

**Project**: Cortex — local-only personal command center. Express.js backend on :3001, React frontend on :5173.

**Stack**: React + Vite + TypeScript, Express.js (TypeScript), Tailwind CSS v4, Vitest.
**Package manager**: npm (NOT pnpm).
**Run tests**: `npm test` (Vitest). `npm run type-check` must stay clean.

**This task builds on TASK-015 and TASK-013**. Read the files created/modified by those tasks before starting. Check `git log` to see recent changes.

**What this task DOES NOT include**: Query, lint, and the frontend WikiPanel — those are TASK-017. This task only builds the backend infrastructure.

### What already exists (from TASK-013)
- `server/lib/ollama-client.ts` — `getOllamaStatus()` and `summarizeProject()` with 1hr cache. The Ollama client already exists and works.
- `server/routes/ai.ts` — `/api/ai/status`, `/api/ai/summarize/:project`, `/api/ai/summarize-all`
- Ollama runs at `http://localhost:11434`, model `llama3.1:8b` (from `OLLAMA_URL` and `OLLAMA_MODEL` env vars)

### What already exists (from TASK-015)
- `server/lib/vault-config.ts` — `getVaultDirs()`, `isPathInVault()`, `getPrimaryVaultDir()`

### Karpathy LLM Wiki pattern (implement this)
Three layers:
1. **Raw sources** — existing notes in VAULT_DIR (immutable — LLM reads, never writes)
2. **Wiki** — `VAULT_DIR/Wiki/` — Ollama-generated markdown pages. LLM owns this entirely.
3. **Schema** — `VAULT_DIR/Wiki/SCHEMA.md` — conventions for how the wiki is structured

Key files the LLM uses to navigate:
- `VAULT_DIR/Wiki/index.md` — catalog of all pages with one-line summaries, updated on every ingest
- `VAULT_DIR/Wiki/log.md` — append-only record of ingests/queries/lints with timestamps

**Why this matters**: Standard RAG re-derives knowledge on every query. The wiki compiles it once, cross-references permanently. "Ask a subtle question requiring 5 sources" — the wiki already has the synthesis, no re-derivation needed.

## Files to Read First
- `.agents/workspace-map.md` — full project structure
- `server/lib/ollama-client.ts` — existing Ollama client to extend (DO NOT rewrite)
- `server/lib/vault-config.ts` — getVaultDirs, getPrimaryVaultDir (from TASK-015)
- `server/index.ts` — how routes are registered
- `server/routes/ai.ts` — pattern for existing Ollama routes

## Task

### 1. Create `VAULT_DIR/Wiki/SCHEMA.md` on first ingest (if not exists)

Seed content (write exactly this):

```markdown
# Cortex Wiki Schema

> Maintained by Cortex + Ollama. Do not edit manually — changes will be overwritten.
> Based on Karpathy's LLM Wiki pattern (April 2026).

## Directory Structure

- `index.md` — Catalog of all pages. Updated on every ingest.
- `log.md` — Append-only ingest/query/lint log.
- `SCHEMA.md` — This file. Conventions guide.
- `*.md` — Topic/entity/concept pages.

## Page Conventions

- **Title**: Use `[[Wikilink]]` format for cross-references to other pages.
- **Frontmatter**: Every page has YAML frontmatter:
  ```yaml
  ---
  title: Page Title
  status: seedling | developing | mature
  sources: [relative/path/to/source.md]
  last_updated: YYYY-MM-DD
  ---
  ```  
- **Page types**: entity (person, project, tool), concept (idea, framework), source (summary of a raw source), synthesis (cross-source analysis).

## Index Format

Each line in index.md:
```
- [[Page Name]] — One-line summary. (sources: N)
```

## Log Format

Each entry in log.md:
```
## [YYYY-MM-DD HH:mm] ingest | Source: filename.md
Brief note about what was added/updated.
```
```

### 2. Create `server/lib/wiki-manager.ts`

```ts
export interface WikiPage {
  name: string           // filename without .md
  path: string           // absolute path
  title: string          // from frontmatter or filename
  status: string         // seedling | developing | mature
  sources: string[]      // from frontmatter sources array
  lastUpdated: string    // from frontmatter last_updated
  summary: string        // from index.md one-liner
}

export interface IngestResult {
  pagesCreated: string[]
  pagesUpdated: string[]
  error?: string
}

/**
 * Ensures Wiki/ directory and SCHEMA.md exist.
 * Creates them if not present. Safe to call on every ingest.
 */
export async function ensureWikiExists(wikiDir: string): Promise<void>

/**
 * Main ingest function.
 * Reads source file, sends to Ollama with wiki-aware prompt, parses response,
 * creates/updates wiki pages, updates index.md, appends to log.md.
 */
export async function ingestSource(sourcePath: string, wikiDir: string): Promise<IngestResult>

/**
 * Reads and parses index.md. Returns array of WikiPage stubs (name + summary only).
 */
export async function readIndex(wikiDir: string): Promise<WikiPage[]>

/**
 * Lists ALL wiki pages by scanning Wiki/*.md (excluding SCHEMA.md, index.md, log.md).
 * Returns full WikiPage objects parsed from frontmatter.
 */
export async function listPages(wikiDir: string): Promise<WikiPage[]>

/**
 * Appends an entry to log.md.
 */
export async function appendLog(wikiDir: string, operation: string, detail: string): Promise<void>
```

**`ingestSource` implementation**:

1. Read source file content (validate it's inside a vault dir with `isPathInVault`)
2. Truncate content to 4000 chars (Ollama context limit)
3. Call Ollama with this prompt:
```
You are maintaining a personal wiki. Given this source document, do the following:

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
${content}
```
4. Parse the Ollama response: extract each `---WIKI_PAGE---` block
5. For each parsed page:
   - Determine file path: `wikiDir/PageName.md`
   - If file exists: merge (append new content under a `## Updated [date]` heading, update frontmatter `last_updated` and add source to `sources` array)
   - If file doesn't exist: create with full frontmatter + content
6. Update `index.md`: add/update one-liner for each touched page
7. Append to `log.md`
8. Return `IngestResult`

**If Ollama is unavailable**: Return `{ pagesCreated: [], pagesUpdated: [], error: "Ollama unavailable" }` — never throw.

### 3. Create `server/routes/wiki.ts`

Endpoints:

**`POST /api/wiki/ingest`**
- Body: `{ sourcePath: string }` — absolute path to source file
- Validate: `sourcePath` must be inside a configured vault or projects dir
- Call `ingestSource(sourcePath, wikiDir)`
- Returns: `{ pagesCreated, pagesUpdated, error? }` with HTTP 200 always (errors in body)
- If wiki doesn't exist yet: `ensureWikiExists` first

**`GET /api/wiki/index`**
- Returns: `{ pages: WikiPage[], wikiExists: boolean }`
- If Wiki/ doesn't exist: return `{ pages: [], wikiExists: false }`

**`GET /api/wiki/pages`**
- Returns: `{ pages: WikiPage[] }`
- Full page list with frontmatter metadata

### 4. Register routes in `server/index.ts`

```ts
import wikiRouter from './routes/wiki'
app.use('/api/wiki', wikiRouter)
```

### 5. Write tests in `server/lib/wiki-manager.test.ts`

Test without calling real Ollama — mock `ollama-client.ts`. Cover:
- `ensureWikiExists`: creates Wiki/ and SCHEMA.md on first call, no-op on subsequent calls
- `ingestSource`: parses Ollama response correctly, creates page files with correct frontmatter
- `ingestSource`: updates existing page (merges, doesn't overwrite)
- `ingestSource`: handles Ollama unavailable gracefully (returns error, doesn't throw)
- `readIndex`: parses `- [[Name]] — Summary. (sources: N)` format
- `listPages`: scans directory, skips SCHEMA/index/log, parses frontmatter
- `appendLog`: appends correct format entry

## Acceptance Criteria
- [ ] `server/lib/wiki-manager.ts` created with all 5 exported functions
- [ ] `server/routes/wiki.ts` with 3 endpoints (ingest, index, pages)
- [ ] Route registered in `server/index.ts`
- [ ] `POST /api/wiki/ingest` creates wiki pages when Ollama responds
- [ ] `POST /api/wiki/ingest` gracefully returns error object when Ollama unavailable
- [ ] `GET /api/wiki/index` returns `{ wikiExists: false }` when wiki not yet initialized
- [ ] `VAULT_DIR/Wiki/SCHEMA.md` seeded with correct content on first ingest
- [ ] `index.md` updated after every ingest
- [ ] `log.md` appended after every ingest
- [ ] Obsidian-compatible `[[wikilinks]]` in generated pages
- [ ] All source paths validated (path traversal protection)
- [ ] All 232+ existing tests still pass
- [ ] New tests cover all wiki-manager functions (mock Ollama)
- [ ] `npm run type-check` clean

## Validation Gates
- [ ] `npm test` — all tests pass
- [ ] `npm run type-check` — zero errors
- [ ] `git add -A && git commit -m "feat(TASK-016): LLM Wiki core — ingest, index, log"`

## Constraints
- Do NOT call real Ollama in tests — mock `ollama-client.ts`
- Do NOT rewrite `ollama-client.ts` — import and use it as-is
- Wiki/ directory: only write inside `VAULT_DIR/Wiki/` (primary vault, NOT secondary VAULT_DIRS)
- Path traversal: source files CAN come from any vault dir or projects dir, but wiki OUTPUT goes only to primary vault
- Do NOT add any npm packages — use only what's already in `package.json`
- Do NOT break existing tests
- Make reasonable assumptions and document them in code comments
