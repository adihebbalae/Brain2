# Handoff: Ollama AI summarization (llama3.1:8b, auto on load)
**Task ID**: TASK-013
**Mode**: autonomous (no user interaction available)

## Context

**Project**: Cortex — local-only personal command center. Express.js backend on :3001, React frontend on :5173.

**This task builds on TASK-011 (full integration)**. The project scanner already reads state files from each project. You're adding AI-powered "where did I leave off?" summaries using the local Ollama API.

**Ollama API**: Ollama runs locally at `http://localhost:11434`. Generate text with:
```
POST http://localhost:11434/api/generate
{
  "model": "llama3.1:8b",
  "prompt": "...",
  "stream": false
}
Response: { "response": "..." }
```
Check if Ollama is running: `GET http://localhost:11434/api/tags` → 200 if up, connection error if not.

**User config**:
- `OLLAMA_URL` — default `http://localhost:11434`
- `OLLAMA_MODEL` — default `llama3.1:8b`

**When to run**: Summaries fetch automatically on dashboard load for all **active** projects (status === 'active'). Stale/archived projects are skipped to keep load time reasonable.

## Task

### Files to create:

#### `server/lib/ollama-client.ts`

```ts
export interface OllamaStatus {
  available: boolean
  model: string
  url: string
}

export interface SummaryResult {
  summary: string | null
  cached: boolean
  error?: string
}

export async function getOllamaStatus(): Promise<OllamaStatus>
export async function summarizeProject(projectName: string, stateFileContent: string, fileMtime: number): Promise<SummaryResult>
```

**`getOllamaStatus`**:
- GET `${OLLAMA_URL}/api/tags`
- Returns `{ available: true, model, url }` on 200
- Returns `{ available: false, model, url }` on error (connection refused, timeout, etc.)
- 3-second timeout

**`summarizeProject`**:
- Cache key: `${projectName}:${fileMtime}` (mtime ensures cache invalidates when file changes)
- 1-hour in-memory cache (Map — not persistent, resets on server restart)
- If cached and not expired: return cached result with `cached: true`
- If Ollama unavailable: return `{ summary: null, error: 'Ollama not available' }`
- Prompt template:
  ```
  You are a developer assistant helping someone quickly re-orient to a project.
  Given the following project state file, write a 2-3 sentence summary answering:
  "Where did I leave off? What's the current status and what should I do next?"
  
  Be specific and actionable. Use first person. Do not include project name.
  
  State file:
  {stateFileContent}
  
  Summary:
  ```
- Truncate `stateFileContent` to first 2000 characters before sending (context window safety)
- POST to `/api/generate` with `stream: false`, 30-second timeout
- On error: return `{ summary: null, error: errorMessage }`

#### `server/routes/ai.ts`

```ts
const router = Router()

// GET /api/ai/status — is Ollama reachable?
router.get('/status', async (_req, res) => { ... })

// GET /api/ai/summarize/:project — summary for one project
router.get('/summarize/:project', async (req, res) => { ... })

// POST /api/ai/summarize-all — bulk summarize all active projects
// Body: { projects: Array<{ name: string, stateFilePath: string }> }
router.post('/summarize-all', async (req, res) => { ... })

export { router as aiRouter }
```

**Path validation on `/summarize/:project`**:
- Resolve `stateFilePath` against `PROJECTS_DIR`
- Reject any path escaping PROJECTS_DIR (path traversal protection)

**`/summarize-all`** runs summarizations sequentially (not Promise.all) to avoid overwhelming Ollama. Returns array of `{ name, summary, cached, error }`.

Mount in `server/index.ts`:
```ts
import { aiRouter } from './routes/ai'
app.use('/api/ai', aiRouter)
```

Add to `.env.example`:
```
# Ollama local AI (https://ollama.ai)
OLLAMA_URL=http://localhost:11434
OLLAMA_MODEL=llama3.1:8b
```

#### Frontend: update `src/hooks/useProjects.ts`

After fetching projects, if any have `status === 'active'`, fire a single `POST /api/ai/summarize-all` with the active project names and their state file paths.

Merge returned summaries into the project objects: each project gets a new `aiSummary: string | null` field.

This should happen **after** the initial projects fetch resolves — don't delay the page render waiting for AI.

```ts
const [aiSummaries, setAiSummaries] = useState<Record<string, string | null>>({})

// After projects load:
useEffect(() => {
  if (projects.length === 0) return
  const active = projects.filter(p => p.status === 'active')
  if (active.length === 0) return
  // POST summarize-all, update aiSummaries state
}, [projects.length])
```

#### Frontend: update `src/components/ProjectCard.tsx`

Add `aiSummary?: string | null` to `ProjectCardProps`. If present and non-null, render it below the state file summary as:

```tsx
<div className="mt-2 text-sm text-indigo-700 bg-indigo-50 rounded px-2 py-1">
  <span className="font-medium text-xs uppercase tracking-wide text-indigo-400">AI · </span>
  {aiSummary}
</div>
```

No loading state for AI — it just appears when ready. No error state — silently absent if null.

#### Tests: `server/lib/ollama-client.test.ts`

- `getOllamaStatus` returns `available: false` when fetch throws (connection refused)
- `summarizeProject` returns cached result on second call with same key
- `summarizeProject` returns `summary: null` when Ollama unavailable
- Cache expires after 1 hour (use vi.useFakeTimers)

Mock `fetch` via `vi.stubGlobal`.

## Acceptance Criteria
- [ ] `GET /api/ai/status` returns `{ available: boolean, model, url }`
- [ ] `GET /api/ai/summarize/:projectName` returns a 2-3 sentence summary for an active project
- [ ] `POST /api/ai/summarize-all` returns summaries for all provided projects
- [ ] 1-hour cache works — second call returns `cached: true`, no Ollama request fired
- [ ] When Ollama is not running: all endpoints return graceful null, no 500 errors
- [ ] Frontend shows AI summary on ProjectCard for active projects
- [ ] AI summary appears after initial page load (non-blocking)
- [ ] Path traversal rejected on `/summarize/:project`
- [ ] Tests pass

## Validation Gates
- [ ] `npm run type-check` → zero errors
- [ ] `npm test` → all tests green

## Constraints
- Do NOT use `axios` or `node-fetch` — native `fetch` only
- Do NOT block the initial page load on AI calls — fire after projects render
- Do NOT show an error state on ProjectCard if AI is unavailable — just hide the AI section
- Truncate state file content to 2000 chars max before sending to Ollama
- Run summarize-all sequentially — NOT `Promise.all` (Ollama handles one request at a time well)
- Do NOT add the `aiSummary` field to the `/api/projects` response — keep concerns separate

## On Completion
```
git add -A
git commit -m "feat(TASK-013): Ollama AI summarization with 1h cache"
```

Update `.agents/state.json` tasks.TASK-013.status to "done".
