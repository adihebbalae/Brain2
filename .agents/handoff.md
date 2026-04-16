# Handoff: LLM Wiki query + lint + dashboard panel
**Task ID**: TASK-017
**Mode**: autonomous (no user interaction available)

## Context

**Project**: Cortex — local-only personal command center. Express.js backend on :3001, React frontend on :5173.

**Stack**: React + Vite + TypeScript, Express.js (TypeScript), Tailwind CSS v4 (`@import "tailwindcss"` style — NOT v3 plugin syntax), Vitest.
**Package manager**: npm (NOT pnpm).
**Run tests**: `npm test`. `npm run type-check` must be clean.

**This task builds on TASK-016**. Read the files created in that task before starting. Check `git log` for recent changes.

### What already exists (from TASK-016)
- `server/lib/wiki-manager.ts` — `ingestSource`, `ensureWikiExists`, `readIndex`, `listPages`, `appendLog`
- `server/routes/wiki.ts` — `POST /api/wiki/ingest`, `GET /api/wiki/index`, `GET /api/wiki/pages`
- `VAULT_DIR/Wiki/` directory with SCHEMA.md, index.md, log.md on first use

### What this task adds
1. **Backend**: Two new wiki endpoints — `POST /api/wiki/query` and `POST /api/wiki/lint`
2. **Frontend**: `WikiPanel` component that appears in the dashboard when `Wiki/` exists

## Files to Read First
- `.agents/workspace-map.md` — full project structure
- `server/lib/wiki-manager.ts` — existing wiki functions (TASK-016)
- `server/routes/wiki.ts` — existing wiki routes (to extend)
- `src/App.tsx` — main dashboard layout (where WikiPanel gets added)
- `src/components/ProjectCard.tsx` — pattern for backend-connected components
- `src/hooks/useProjects.ts` — pattern for data fetching hooks

## Task

### 1. Extend `server/lib/wiki-manager.ts` — add two functions

#### `queryWiki(question: string, wikiDir: string): Promise<QueryResult>`

```ts
export interface QueryResult {
  answer: string
  citations: string[]   // page names referenced in the answer
  error?: string
}
```

Implementation:
1. Check if wiki exists (`Wiki/index.md` must exist) — if not: return `{ answer: '', citations: [], error: 'Wiki not initialized' }`
2. Read `index.md` to get the page catalog
3. Find relevant pages: simple keyword match — split `question` into words (≥4 chars), find pages whose summary or name contains any of those words (case-insensitive). Keep top 5.
4. Read the content of each relevant page
5. Call Ollama with:
```
You are answering a question using a personal wiki. Use only the provided wiki pages.
Cite pages by name using [[PageName]] format.

Wiki pages:
${pages.map(p => `[[${p.name}]]:\n${p.content}`).join('\n\n---\n\n')}

Question: ${question}

Answer concisely (2-4 sentences) with [[citations]]:
```
6. Parse [[PageName]] citations from response
7. Append to `log.md`: `## [date] query | ${question.slice(0,50)}`
8. Return `{ answer, citations }`
9. If Ollama unavailable: return `{ answer: '', citations: [], error: 'Ollama unavailable' }`

#### `lintWiki(wikiDir: string): Promise<LintResult>`

```ts
export interface LintResult {
  orphans: string[]        // pages with no inbound [[links]] from other pages
  stale: string[]          // pages where source file is newer than wiki page mtime
  gaps: string[]           // [[links]] referenced in pages but no corresponding .md file
  healthScore: number      // 0-100: 100 = perfect, -5 per orphan, -10 per stale, -10 per gap
}
```

Implementation:
1. List all wiki pages (`listPages`)
2. Read each page's content
3. **Orphans**: build inbound link map — for each page, find all `[[PageName]]` references in its content; any page not referenced by any other page is an orphan. (Skip index.md/log.md in this check.)
4. **Stale**: for each page, check its `sources` frontmatter array — for each source path, check if `fs.statSync(sourcePath).mtime > fs.statSync(wikiPage).mtime`. If source is newer → stale.
5. **Gaps**: collect all `[[PageName]]` references across all pages — find any that don't have a corresponding `PageName.md` in the wiki dir.
6. **healthScore**: start at 100, subtract 5 per orphan, 10 per stale, 10 per gap, clamp to 0.
7. Append to `log.md`: `## [date] lint | score: ${healthScore}, orphans: ${orphans.length}, stale: ${stale.length}, gaps: ${gaps.length}`
8. Return `LintResult`

### 2. Extend `server/routes/wiki.ts` — add two endpoints

**`POST /api/wiki/query`**
- Body: `{ question: string }` — validate non-empty, max 500 chars
- Returns 200: `QueryResult`

**`POST /api/wiki/lint`**
- No body
- Returns 200: `LintResult` + `{ wikiExists: boolean }`

### 3. Create `src/hooks/useWiki.ts`

```ts
interface WikiState {
  wikiExists: boolean
  pages: WikiPage[]
  loading: boolean
  error: string | null
}

interface WikiPage {
  name: string
  title: string
  status: string
  sources: string[]
  lastUpdated: string
  summary: string
}

export function useWiki(): WikiState & {
  query: (question: string) => Promise<{ answer: string; citations: string[] }>
  lint: () => Promise<LintResult>
  ingest: (sourcePath: string) => Promise<{ pagesCreated: string[]; pagesUpdated: string[] }>
  refetch: () => void
}
```

- Fetches `GET /api/wiki/index` on mount
- `wikiExists` drives conditional render in WikiPanel
- `query`, `lint`, `ingest` are async functions that call the respective POST endpoints

### 4. Create `src/components/WikiPanel.tsx`

Renders conditionally — only when `wikiExists: true` from `useWiki()`.

When wiki doesn't exist yet: render a subtle "No wiki yet — ingest a file to start" empty state with an Ingest button.

**Layout** (Tailwind, dark sidebar style like other components):
```
┌──────────────────────────────────┐
│  🧠 Wiki  [health badge]  [Lint] │
├──────────────────────────────────┤
│  [Query input........................] [Ask] │
│                                            │
│  [Answer text]                             │
│  Cited: [[Page1]] [[Page2]]                │
├──────────────────────────────────┤
│  Pages (N)                       │
│  · PageName — summary  [seedling]│
│  · ...                           │
├──────────────────────────────────┤
│  Ingest: [_____________path____] [Ingest] │
└──────────────────────────────────┘
```

**Health badge**: 
- Score > 80: green `bg-green-100 text-green-800`
- Score 50–80: amber `bg-yellow-100 text-yellow-800`
- Score < 50: red `bg-red-100 text-red-800`
- Shows "Health: {score}" or "Not linted" before first lint

**Query section**:
- Text input, 500ms debounce — but only submit on Enter or button click (debounce for UX, not auto-submit)
- While loading: show spinner
- After answer: show answer text + citation chips `[[PageName]]` as small badges

**Pages list**: scrollable, max-height 300px, one line per page: name + summary + status badge

**Ingest section**: text input for file path (absolute), "Ingest" button. On success: show toast "Created N pages, updated M pages". On error: show error message.

**Lint button**: triggers `lint()`, updates health badge. Shows toast with orphan/stale/gap counts.

### 5. Add WikiPanel to `src/App.tsx`

Import and render `WikiPanel` below the main content area (after `ChatExplorer`). Wrap in the same container style as other dashboard sections.

### 6. Write tests

**`server/lib/wiki-manager.test.ts`** (extend existing file from TASK-016):
- `queryWiki`: mock Ollama, returns answer with citations parsed correctly
- `queryWiki`: returns error when wiki not initialized
- `lintWiki`: orphan detection correct
- `lintWiki`: gap detection (referenced pages that don't exist)
- `lintWiki`: health score calculation (100 - 5*orphans - 10*stale - 10*gaps, clamped to 0)

**`src/components/WikiPanel.test.tsx`**:
- Renders empty state when `wikiExists: false`
- Renders page list when `wikiExists: true`
- Health badge color correct for each tier
- Query input submits on Enter
- Ingest input shows success toast

## Acceptance Criteria
- [ ] `queryWiki` function added to `wiki-manager.ts`
- [ ] `lintWiki` function added to `wiki-manager.ts`
- [ ] `POST /api/wiki/query` endpoint works
- [ ] `POST /api/wiki/lint` endpoint returns `{ orphans, stale, gaps, healthScore, wikiExists }`
- [ ] `src/hooks/useWiki.ts` created
- [ ] `src/components/WikiPanel.tsx` created
- [ ] WikiPanel renders in `App.tsx`
- [ ] WikiPanel hidden / empty-state when wiki not initialized
- [ ] Health badge shows correct color tier
- [ ] All 232+ existing tests still pass
- [ ] New tests for query, lint, WikiPanel component
- [ ] `npm run type-check` clean

## Validation Gates
- [ ] `npm test` — all tests pass
- [ ] `npm run type-check` — zero errors
- [ ] `git add -A && git commit -m "feat(TASK-017): LLM Wiki query, lint, and WikiPanel"`

## Constraints
- Do NOT call real Ollama in tests — mock the client
- Tailwind: use `@import "tailwindcss"` style (v4), NOT `tailwindcss/plugin` patterns
- Do NOT install new npm packages
- Do NOT break existing tests
- WikiPanel only renders when `wikiExists` is true — do not show an empty panel to users without a wiki
