# Handoff: Backend — Deadline reader & urgency calculation
**Task ID**: TASK-005
**Mode**: autonomous (no user interaction available)

## Context

**Project**: Cortex — local-only personal command center. React+Vite frontend on :5173, Express.js TypeScript backend on :3001.

**This task builds on TASK-001**. Project is scaffolded. You're creating `server/lib/deadline-reader.ts` and `server/routes/deadlines.ts`.

**Why this task matters**: Deadline visibility is a core P0 feature. The color-coded urgency timeline is the first thing Adi sees when opening the dashboard. Frontend TASK-009 (deadline timeline component) depends on this endpoint returning correct urgency levels.

**Source file**: `C:\Users\boomb\Documents\SecondBrain\Deadlines\deadlines.md` (VAULT_DIR/Deadlines/deadlines.md)

## Task

Implement `GET /api/deadlines` — parses deadlines.md and returns deadline objects with urgency levels.

### File format to parse:

```markdown
- [ ] 2026-04-10 | ECE319H Lab 8 due | school
- [ ] 2026-04-15 | M325K Homework 9 | school
- [x] 2026-04-01 | M325K Midterm 3 | school
```

Rules:
- Line must start with `- [ ] ` or `- [x] `
- Date is in `YYYY-MM-DD` format
- `|` is the delimiter
- Third field (tag) is optional
- Lines not matching this format are silently skipped
- Lines starting with `#` or `>` are comments/headers — skip them

### Files to create:

#### `server/lib/deadline-reader.ts`

```ts
export interface DeadlineItem {
  id: string           // sha256(date + "|" + description) first 12 hex chars
  date: string         // ISO date string (YYYY-MM-DD)
  description: string
  tag: string | null   // school, project, personal, tutoring, poker — or null
  done: boolean
  urgency: 'red' | 'amber' | 'green' | 'gray'
  daysUntil: number    // negative = overdue, 0 = today
}

export async function readDeadlines(vaultDir: string): Promise<DeadlineItem[]>
```

**Urgency calculation** (based on days until due date, evaluated at request time):
- `'gray'` — done=true (completed, regardless of date)
- `'red'` — daysUntil <= 2 (within 48 hours OR overdue)
- `'amber'` — daysUntil <= 7 (within a week)
- `'green'` — daysUntil > 7

**Sort order**:
1. Non-done items sorted by date ascending (soonest first)
2. Done items at the end, sorted by date descending (most recently completed first)

**File not found handling**: If deadlines.md doesn't exist, return empty array (not an error — this is normal on first run before TASK-002 runs).

**Security**: Validate vaultDir path before reading. The deadlines.md path must be inside vaultDir.

#### `server/routes/deadlines.ts`

```ts
import { Router } from 'express'
import { readDeadlines } from '../lib/deadline-reader'
import { config } from 'dotenv'

config()

const router = Router()

router.get('/', async (_req, res) => {
  const { VAULT_DIR } = process.env
  if (!VAULT_DIR) {
    return res.status(500).json({ error: 'VAULT_DIR not configured' })
  }
  try {
    const deadlines = await readDeadlines(VAULT_DIR)
    return res.json(deadlines)
  } catch (err) {
    return res.status(500).json({ error: 'Failed to read deadlines' })
  }
})

export { router as deadlinesRouter }
```

Mount in `server/index.ts`:
```ts
import { deadlinesRouter } from './routes/deadlines'
app.use('/api/deadlines', deadlinesRouter)
```

#### Tests: `server/lib/deadline-reader.test.ts`

Create a temp deadlines.md with test content. Test:
- Basic parsing: date, description, tag, done all extracted correctly
- Tag is null when not provided
- Urgency: done items → gray
- Urgency: item due tomorrow → red
- Urgency: item due in 5 days → amber
- Urgency: item due in 10 days → green
- Urgency: overdue item (past date) → red
- Sort order: pending items sorted ascending, done items at end
- Lines not matching format are skipped
- Empty file returns empty array
- File not found returns empty array (not an error)

## Acceptance Criteria
- [ ] `GET /api/deadlines` returns sorted array with urgency levels
- [ ] Parsed fields: id, date, description, tag (or null), done, urgency, daysUntil
- [ ] Urgency: gray=done, red=≤2d, amber=≤7d, green=>7d
- [ ] Overdue items show urgency='red' with negative daysUntil
- [ ] Sort: pending ascending, done at end
- [ ] Missing deadlines.md returns empty array (not 404)
- [ ] Tests pass

## Validation Gates
- [ ] `pnpm type-check` → zero errors
- [ ] `pnpm test` → all tests green

## Constraints
- Do NOT write to deadlines.md — this is read-only
- Do NOT require deadlines.md to exist (graceful empty array fallback)
- Urgency is calculated at request time (not stored)

## On Completion
```
git add -A
git commit -m "feat(TASK-005): deadline reader with urgency calculation and unit tests"
```

Update `.agents/state.json` tasks.TASK-005.status to "done".
