# Handoff: Integration — Wire all components, polling, error states, E2E tests
**Task ID**: TASK-011
**Mode**: autonomous (no user interaction available)

## Context

**Project**: Cortex — local-only personal command center. React+Vite+TypeScript frontend on :5173, Express backend on :3001.

**This is the final integration task**. All four feature components exist:
- `ProjectCard.tsx` + `StatusOverview.tsx` (TASK-007)
- `TodoAggregator.tsx` (TASK-008)
- `DeadlineTimeline.tsx` (TASK-009)
- `QuickCapture.tsx` (TASK-010)

And all backend routes exist:
- `GET /api/projects` (TASK-003)
- `GET /api/todos` + `PATCH /api/todos/:id` (TASK-004)
- `GET /api/deadlines` (TASK-005)
- `POST /api/capture` (TASK-006)

**Why this task matters**: Without integration, each component is an island. This task:
1. Wires everything into the `App.tsx` shell
2. Adds 60-second polling so the dashboard refreshes automatically
3. Adds proper loading states and error boundaries
4. Validates the complete PRD success criteria with an integration test

## Task

### 1. Wire `src/App.tsx`

Full dashboard layout:
```
+------------------------------------------+
|  CORTEX                        2026-04-05 |
|  [Ctrl+K — Capture a thought...] [Capture]|
+----------------+-------------------------+
| StatusOverview |                          |
|                |   DeadlineTimeline       |
| ProjectCard    |                          |
| ProjectCard    |   TodoAggregator         |
| ProjectCard    |                          |
+----------------+-------------------------+
```

- Render `<QuickCapture onCapture={() => { refetchTodos(); refetchProjects(); }} />`
- Render `<StatusOverview />` spanning full width above the two-column grid
- Left column: project card grid (2 cards wide on md+, 1 on sm)
- Right column: `<DeadlineTimeline compact={false} />` on top, `<TodoAggregator />` below
- Pass down `refetch` callbacks so QuickCapture triggers a todos refresh

### 2. Add 60-second polling to all data hooks

In `src/hooks/useProjects.ts`, `src/hooks/useTodos.ts`, `src/hooks/useDeadlines.ts`:

```ts
useEffect(() => {
  fetchData()
  const id = setInterval(fetchData, 60_000)
  return () => clearInterval(id)
}, [])
```

**Critical**: return the cleanup function to avoid memory leaks on unmount.

### 3. Loading skeletons

Each component (ProjectCard grid, TodoAggregator, DeadlineTimeline) should already have loading skeletons from their individual tasks. Verify they render during initial load.

If any are missing:
- Project grid loading: 3 cards with `animate-pulse` gray blocks
- Todo list loading: 5 rows with light gray bars
- Deadline loading: 3 slim rows with gray bars

### 4. Error boundary: `src/components/ErrorBoundary.tsx`

Simple React class-based error boundary component:
- Catches JS errors in child tree
- Shows fallback: "Something went wrong in this section. [Retry]"
- Retry resets the error state (force re-render of children)

Wrap each major section (projects, todos, deadlines) in an ErrorBoundary.

### 5. Empty states

Verify each component has an empty state message:
- Projects: "No projects found in [PROJECTS_DIR path]"
- Todos: "No open TODOs — you're all caught up! 🎉"
- Deadlines: "No upcoming deadlines"

These should already be in the components. Verify they render when API returns empty arrays.

### 6. Integration test: `server/integration.test.ts`

Uses a temporary test directory — does NOT use real `PROJECTS_DIR`/`VAULT_DIR`:

```ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { join } from 'node:path'

const TEST_DIR = join(import.meta.dirname, '__test_projects__')
const TEST_VAULT = join(import.meta.dirname, '__test_vault__')

// Scaffold test fixture
beforeAll(() => {
  // Create test project with state file + todo file + deadline file
})

afterAll(() => {
  rmSync(TEST_DIR, { recursive: true, force: true })
  rmSync(TEST_VAULT, { recursive: true, force: true })
})
```

**Test the full pipeline**:
1. Scanner finds project in TEST_DIR
2. TODO extractor finds `- [ ]` items from the project's files
3. Deadline reader parses deadlines.md from TEST_VAULT
4. Capture writer appends to TEST_VAULT/Inbox/inbox.md
5. State detection priority: `agent_state.md` → `Agent_State.json` → `state.md` → `Status.md` → `README.md`

### 7. Validate PRD success criteria

In a test or as a commented checklist comment at top of `integration.test.ts`, document each acceptance criterion from the PRD and which test covers it:

From PRD (must all pass):
- [ ] "Today's most pressing deadlines visible within 3 seconds of opening": covered by integration test timing deadline API
- [ ] "Mark any TODO done permanently updates the source file": covered by PATCH test
- [ ] "Quick capture → visible in vault within 5 seconds": covered by capture test
- [ ] "All project statuses visible in one view": covered by scanner test
- [ ] "Works fully offline": no network calls in any code path (verify no fetch to external URLs)

## Acceptance Criteria
- [ ] App renders all 4 components in correct layout
- [ ] 60-second polling active in all data hooks (verified by unit test)
- [ ] Quick capture triggers todo + project refetch
- [ ] Error boundary catches component crashes gracefully
- [ ] Loading skeletons visible during initial fetch
- [ ] Empty states render correctly for each section
- [ ] Integration test creates fixture, tests full backend pipeline, cleans up
- [ ] All PRD success criteria documented and passing
- [ ] `pnpm dev` starts without errors — app loads fully in browser

## Validation Gates
- [ ] `pnpm type-check` → zero errors
- [ ] `pnpm test` → all tests green (unit + integration)
- [ ] `pnpm dev` → app loads at localhost:5173 with no console errors
- [ ] All 5 backend routes return 200 with valid data when dev server running

## Constraints
- Do NOT add a real-time websocket — polling only
- Do NOT import any state management library (Redux, Zustand, etc.) — React useState/useEffect only
- The integration test MUST use a temp directory and clean up after itself
- Do NOT change the file write-back mechanism — only TODO toggle and inbox.md append are allowed file writes
- Do NOT add any external dependencies — use only existing packages from package.json

## On Completion
```
git add -A
git commit -m "feat(TASK-011): full integration, polling, error boundaries, E2E tests"
```

Update `.agents/state.json` tasks.TASK-011.status to "done".
Update `.agents/state.json` `status` field to "mvp_complete".
Update `.agents/state.md` with completion summary.
