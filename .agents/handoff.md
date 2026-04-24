# Handoff: Velocity Tracking + Deadline Risk Scores
**Task ID**: TASK-044
**Mode**: autonomous (no user interaction available)

## Context

**Project**: Cortex — local-only personal command center dashboard. React+Vite+TypeScript frontend on :5173, Express.js TypeScript backend on :3001. Repo at `C:\Users\boomb\Documents\_Projects\Brain2`.

**What exists**: TODO extractor (`server/lib/todo-extractor.ts`) with GET /api/todos returning all TODOs. Git activity parser (`server/lib/git-activity-parser.ts`) scanning PROJECTS_DIR. Deadline reader (`server/lib/deadline-reader.ts`) with GET /api/deadlines. HomePage already has multiple panels (DailyPanel, AISummaryPanel, etc.).

## Task

### 1. Install dependencies

```bash
npm install simple-git recharts
```

### 2. Create `server/lib/velocity-tracker.ts`

```typescript
interface DailySnapshot {
  date: string        // YYYY-MM-DD
  todosOpen: number
  todosClosed: number
  commitsToday: number
}

export async function recordDailySnapshot(): Promise<DailySnapshot>
export function getVelocityData(days?: number): DailySnapshot[]
export function getWeeklyAverage(snapshots: DailySnapshot[]): { todosPerWeek: number, commitsPerWeek: number }
```

- On server startup, call `recordDailySnapshot()`:
  - Use `simple-git` to count today's commits across PROJECTS_DIR
  - Use existing TODO extractor to count open (`- [ ]`) and closed (`- [x]`) TODOs
  - Append to `VAULT_DIR/.cortex-velocity.json` (create if missing)
  - Deduplicate by date (if today already exists, update it)
- `getVelocityData(days=90)`: read the JSON file, return last N days
- `getWeeklyAverage(snapshots)`: compute average todos closed + commits per week from the data

### 3. Add GET /api/velocity route

In `server/routes/` (new file `velocity.ts`):
- Returns `{ snapshots: DailySnapshot[], trend: { todosDirection: 'up'|'down'|'flat', commitsDirection: 'up'|'down'|'flat' } }`
- Trend: compare this week's average vs last week's average

### 4. Add deadline risk scores to GET /api/deadlines

In `server/lib/deadline-reader.ts` or the deadlines route:
- For each deadline, compute: `riskScore = remainingTodos / (avgTodosCompletedPerWeek * weeksUntilDeadline)`
- `remainingTodos`: count of open TODOs for that project (from TODO extractor)
- `avgTodosCompletedPerWeek`: from velocity tracker
- `weeksUntilDeadline`: `(deadlineDate - today) / 7`
- Add `riskScore: number | null` to each deadline in the API response
- `null` when no velocity data available or deadline has no associated project

### 5. Create VelocityPanel component (`src/components/VelocityPanel.tsx`)

Using Recharts:
```tsx
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
```

- Fetch from GET /api/velocity
- Render a bar chart with two series: todos closed (green) and commits (blue)
- Show trend arrows (↑/↓/→) comparing this week vs last week
- Add to HomePage alongside existing panels

### 6. Update DeadlineTimeline with risk badges

In `src/components/DeadlineTimeline.tsx`:
- Read `riskScore` from the deadline API response
- Display a small color-coded badge next to each deadline:
  - `riskScore > 1.0` → 🔴 red badge "At Risk"
  - `0.7 <= riskScore <= 1.0` → 🟡 amber badge "Tight"
  - `riskScore < 0.7` → 🟢 green badge "On Track"
  - `riskScore === null` → no badge

### 7. Register in server/index.ts

Mount the velocity router: `app.use('/api/velocity', velocityRouter)`

### 8. Run tests and commit

- `npm test -- --reporter=dot`
- `npx tsc --noEmit`
- `git add -A && git commit -m "feat(TASK-044): velocity tracking with recharts + deadline risk scores"`

## Acceptance Criteria
- [ ] Daily snapshot appended to VAULT_DIR/.cortex-velocity.json on server startup
- [ ] Deduplicates by date (one entry per day)
- [ ] GET /api/velocity returns array of daily snapshots (last 90 days) + trend
- [ ] VelocityPanel renders Recharts bar chart with two series (todos, commits)
- [ ] Trend arrow shows week-over-week direction (up/down/flat)
- [ ] GET /api/deadlines includes riskScore field per deadline
- [ ] Risk formula: remainingTodos / (avgTodosPerWeek * weeksUntilDeadline)
- [ ] DeadlineTimeline shows color-coded risk badge
- [ ] Graceful when no velocity data available (risk = null, no badge shown)
- [ ] Tests for snapshot recording, deduplication, and trend calculation

## Validation Gates
- [ ] `npm test -- --reporter=dot` passes
- [ ] `npx tsc --noEmit` no new errors
- [ ] `git commit` done

## Files to Read First
- `server/lib/todo-extractor.ts` — TODO counting logic
- `server/lib/git-activity-parser.ts` — git scanning pattern
- `server/lib/deadline-reader.ts` — deadline parsing
- `server/routes/deadlines.ts` — deadline route to extend
- `src/pages/HomePage.tsx` — where to add VelocityPanel
- `src/components/DeadlineTimeline.tsx` — where to add risk badges

## Constraints
- Use `simple-git` for git operations — do NOT use child_process.execSync
- Use `recharts` for charts — do NOT build custom SVG
- Velocity file lives in VAULT_DIR (first vault dir), not in PROJECTS_DIR
- Do NOT ask questions — make reasonable assumptions and document them
