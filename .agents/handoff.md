# Handoff: Backend — Quick capture endpoint + notes corpus parser
**Task ID**: TASK-006
**Mode**: autonomous (no user interaction available)

## Context

**Project**: Cortex — local-only personal command center. React+Vite frontend on :5173, Express.js TypeScript backend on :3001.

**This task builds on TASK-001 and TASK-002**. Project is scaffolded (TASK-001) and Obsidian vault exists at `C:\Users\boomb\Documents\SecondBrain` (TASK-002). You're adding `server/routes/capture.ts` and notes corpus parsing to server/lib.

**Why this task matters**: Quick capture is the "dump" workflow — the top input bar on the dashboard. It's used constantly. Also, parsing the existing notes corpus (`notes_corpus.txt.txt`) makes years of Adi's existing notes available in the TODO list immediately, which provides instant value.

**Target files**:
- Quick capture → `C:\Users\boomb\Documents\SecondBrain\Inbox\inbox.md`
- Notes corpus (parse only) → `C:\Users\boomb\Documents\notes_corpus.txt.txt`

## Task

Implement `POST /api/capture` and `GET /api/corpus`.

### Files to create:

#### `server/routes/capture.ts`

```ts
import { Router } from 'express'
import { appendCapture } from '../lib/capture-writer'
import { config } from 'dotenv'

config()

const router = Router()

router.post('/', async (req, res) => {
  const { VAULT_DIR } = process.env
  if (!VAULT_DIR) {
    return res.status(500).json({ error: 'VAULT_DIR not configured' })
  }

  const { text } = req.body as { text?: unknown }

  // Input validation
  if (typeof text !== 'string' || text.trim().length === 0) {
    return res.status(400).json({ error: 'text is required and must be a non-empty string' })
  }
  if (text.length > 2000) {
    return res.status(400).json({ error: 'text must be 2000 characters or fewer' })
  }

  try {
    const entry = await appendCapture(text.trim(), VAULT_DIR)
    return res.json({ success: true, entry })
  } catch (err) {
    return res.status(500).json({ error: 'Failed to write capture' })
  }
})

export { router as captureRouter }
```

#### `server/lib/capture-writer.ts`

```ts
import { appendFile, mkdir } from 'node:fs/promises'
import { join, resolve } from 'node:path'

export async function appendCapture(text: string, vaultDir: string): Promise<string> {
  // Validate vaultDir path
  const resolvedVault = resolve(vaultDir)
  const inboxPath = join(resolvedVault, 'Inbox', 'inbox.md')

  // Ensure Inbox directory exists
  await mkdir(join(resolvedVault, 'Inbox'), { recursive: true })

  // Format timestamp: YYYY-MM-DD HH:mm
  const now = new Date()
  const timestamp = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`

  const entry = `- [ ] [${timestamp}] ${text}`
  await appendFile(inboxPath, entry + '\n', 'utf-8')

  return entry
}
```

#### `server/lib/notes-corpus-parser.ts`

Parses the existing unstructured notes file (`notes_corpus.txt.txt`) for actionable items.

```ts
export interface CorpusItem {
  id: string
  text: string
  type: 'todo' | 'idea' | 'note'
  source: 'corpus'
}

export async function parseNotesCorpus(corpusPath: string): Promise<CorpusItem[]>
```

Parse heuristics for `notes_corpus.txt.txt`:
- Lines starting with `- [ ]`, `[ ]`, `*`, `-`, `•` followed by text → type='todo'
- Lines containing "idea:", "idea -", or all-caps prefix like "IDEA:" → type='idea'
- Lines starting with "TODO", "todo", "FIXME" → type='todo'
- Non-empty lines that are at least 10 chars → type='note' (fallback)
- Skip blank lines, lines with only punctuation, header lines (all-caps short strings)

**File not found**: Return empty array silently (corpus file may not exist).

**Security**: Validate corpusPath is a valid absolute path (no traversal). Since this is a hardcoded path from env, just resolve and check it's readable.

#### Add corpus route to `server/routes/capture.ts` (OR create separate file):

```ts
router.get('/corpus', async (_req, res) => {
  const corpusPath = process.env.NOTES_CORPUS
  if (!corpusPath) {
    return res.json([])
  }
  try {
    const { parseNotesCorpus } = await import('../lib/notes-corpus-parser')
    const items = await parseNotesCorpus(corpusPath)
    return res.json(items)
  } catch {
    return res.json([])
  }
})
```

Add `NOTES_CORPUS=C:\Users\boomb\Documents\notes_corpus.txt.txt` to `.env.example`.

Mount in `server/index.ts`:
```ts
import { captureRouter } from './routes/capture'
app.use('/api/capture', captureRouter)
```

#### Tests: `server/lib/capture-writer.test.ts`

Use a temp directory:
- `appendCapture` creates inbox.md if it doesn't exist
- Entry format is exactly `- [ ] [YYYY-MM-DD HH:mm] text\n`
- Multiple appends stack correctly in the file
- Empty string returns 400 (test via route if possible, or directly test validation)
- Text > 2000 chars is rejected

## Acceptance Criteria
- [ ] `POST /api/capture` with `{ text: "hello" }` appends to inbox.md
- [ ] Entry format: `- [ ] [YYYY-MM-DD HH:mm] hello`
- [ ] Returns `{ success: true, entry: "- [ ] [2026-04-05 14:32] hello" }`
- [ ] Empty text returns 400
- [ ] Text >2000 chars returns 400
- [ ] Creates inbox.md and parent directory if they don't exist
- [ ] `GET /api/capture/corpus` returns parsed items from notes_corpus.txt.txt (or empty array if missing)
- [ ] Tests pass

## Validation Gates
- [ ] `pnpm type-check` → zero errors
- [ ] `pnpm test` → all tests green

## Constraints
- Do NOT allow capture text to contain newlines (strip them or reject)
- Do NOT overwrite inbox.md — ALWAYS append
- User input must be sanitized before writing to file (strip null bytes, control characters)
- Max capture length: 2000 characters

## On Completion
```
git add -A
git commit -m "feat(TASK-006): quick capture endpoint and notes corpus parser"
```

Update `.agents/state.json` tasks.TASK-006.status to "done".
