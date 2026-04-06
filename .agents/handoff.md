# Handoff: Backend — Project scanner & state file parser
**Task ID**: TASK-003
**Mode**: autonomous (no user interaction available)

## Context

**Project**: Cortex — local-only personal command center. React+Vite frontend on :5173, Express.js TypeScript backend on :3001. No database — all filesystem reads.

**This task builds on TASK-001**. The project is now scaffolded. `server/` directory exists with `server/index.ts` (Express entry). You're adding `server/lib/scanner.ts`, `server/lib/state-reader.ts`, and `server/routes/projects.ts`.

**Why this task matters**: The project scanner is the core of Cortex — it's what makes every project visible. Without this, the dashboard is empty. Frontend TASK-007 (project cards) directly depends on this endpoint being correct.

**Paths** (from `.env`):
- `PROJECTS_DIR=C:\Users\boomb\Documents\_Projects`
- `VAULT_DIR=C:\Users\boomb\Documents\SecondBrain`

## Task

Implement `GET /api/projects` — scans PROJECTS_DIR, detects state files, parses them, and returns structured project data.

### Files to create:

#### `server/lib/state-reader.ts`

Responsible for reading a single project's state file and extracting structured data.

```ts
export interface ProjectState {
  name: string
  path: string
  stateFile: string
  status: 'in_progress' | 'blocked' | 'completed' | 'not_started' | 'stale'
  lastModified: string  // ISO string
  summary: string
  nextSteps: string[]
  staleDays: number
}

// Priority order for state file detection
const STATE_FILE_PRIORITY = [
  'agent_state.md',
  'Agent_State.json',
  'state.md',
  'Status.md',
  'README.md',
]
```

State file detection logic:
1. Check each filename in priority order
2. Return the first that exists in the project folder

Status inference logic (when no frontmatter `status:` field):
- `'completed'` — content contains "completed", "shipped", "done", "finished"
- `'blocked'` — content contains "blocked", "waiting on", "stuck"
- `'not_started'` — content contains "not started", "idea", "concept", "todo"
- `'stale'` — lastModified > 14 days ago (and not completed/not_started)
- `'in_progress'` — default fallback

Stale thresholds:
- `staleDays` = days since last modification
- UI will show amber at >14 days, red at >30 days

Summary extraction (try each in order):
1. If markdown has `## Summary` or `## Overview` section → take first 2-3 sentences
2. If markdown has `## Status` section with content → take that content
3. Last 2-3 non-empty lines of the file
4. First 200 characters of file

Next steps extraction (try each in order):
1. `## Next Steps` section → extract bullet points (max 5)
2. `## TODO` section → extract bullet points
3. Any `- [ ]` items in the last 50 lines

Security: validate that every resolved file path is inside PROJECTS_DIR before reading. Reject any path that escapes via `../` etc.

#### `server/lib/scanner.ts`

Scans the projects directory and returns all projects.

```ts
import type { ProjectState } from './state-reader'

export async function scanProjects(projectsDir: string): Promise<ProjectState[]>
```

Implementation:
1. Read all immediate subdirectories of projectsDir (not recursive — one level)
2. Skip hidden directories (starting with `.`)
3. For each subdirectory, call state-reader to find and parse state file
4. Skip folders with no state file found
5. Sort results by `lastModified` descending (most recent first)

#### `server/routes/projects.ts`

```ts
import { Router } from 'express'
import { scanProjects } from '../lib/scanner'
import { config } from 'dotenv'

config()

const router = Router()

router.get('/', async (_req, res) => {
  try {
    const projectsDir = process.env.PROJECTS_DIR
    if (!projectsDir) {
      return res.status(500).json({ error: 'PROJECTS_DIR not configured' })
    }
    const projects = await scanProjects(projectsDir)
    return res.json(projects)
  } catch (err) {
    console.error('Failed to scan projects:', err)
    return res.status(500).json({ error: 'Failed to scan projects' })
  }
})

export { router as projectsRouter }
```

#### Update `server/index.ts`

Mount the route:
```ts
import { projectsRouter } from './routes/projects'
app.use('/api/projects', projectsRouter)
```

#### Tests: `server/lib/scanner.test.ts`

Use `vi.mock('node:fs/promises')` or create a temp directory for testing. Test:
- Priority detection: when both `agent_state.md` and `state.md` exist, `agent_state.md` is chosen
- Status inference: "blocked" in content → status is 'blocked'
- Stale calculation: file modified 20 days ago → staleDays is ~20
- Summary extraction: `## Next Steps` section parsed correctly
- Path validation: path outside PROJECTS_DIR is rejected

## Acceptance Criteria
- [ ] `GET /api/projects` returns array of project objects
- [ ] Each object has: name, path, stateFile, status, lastModified, summary, nextSteps, staleDays
- [ ] State file priority detection: agent_state.md chosen over state.md when both exist
- [ ] Status inference from content keywords works correctly
- [ ] staleDays is an integer (number of days since last file modification)
- [ ] Projects sorted by lastModified descending
- [ ] Path traversal protection: no file outside PROJECTS_DIR can be read
- [ ] Tests pass with `pnpm test`

## Validation Gates
- [ ] `pnpm type-check` → zero errors
- [ ] `pnpm test` → all tests green

## Constraints
- Do NOT read subdirectories recursively (only top-level folders in PROJECTS_DIR are projects)
- Do NOT modify any files in PROJECTS_DIR
- Do NOT implement caching — that comes later
- Use `import type` for type-only imports
- Named exports only
- All file reads MUST validate that path is inside PROJECTS_DIR

## On Completion
```
git add -A
git commit -m "feat(TASK-003): project scanner with state file parser and unit tests"
```

Update `.agents/state.json` tasks.TASK-003.status to "done".
