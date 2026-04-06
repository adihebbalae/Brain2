# Handoff: Frontend — TODO aggregator with mark-done
**Task ID**: TASK-008
**Mode**: autonomous (no user interaction available)

## Context

**Project**: Cortex — local-only personal command center. React+Vite+TypeScript frontend on :5173, Express backend on :3001.

**Depends on TASK-004 (backend TODO extractor)**. The backend has `GET /api/todos` returning todos grouped by project, and `PATCH /api/todos/:id` for toggling completion state.

**API shapes**:
```ts
// GET /api/todos response
interface Todo {
  id: string             // SHA-256 based ID
  text: string
  done: boolean
  file: string           // relative path within project
  line: number           // 1-based line number
  project: string        // project folder name
  type: 'checkbox' | 'TODO' | 'FIXME' | 'HACK'
}

// PATCH /api/todos/:id body
{ done: boolean }

// PATCH /api/todos/:id response
{ success: true } | { error: string }
```

## Task

Build `src/components/TodoAggregator.tsx`.

### Component interface
```tsx
interface TodoAggregatorProps {
  onCountChange?: (openCount: number) => void // optional — for stats bar update
}
```

### Features

**Display**:
- List of all open todos grouped by project name (collapsible group headers)
- Each todo: checkbox (unchecked) + text + file chip (truncated file path) + type badge (if FIXME/HACK)
- Completed todos: show as checked + strikethrough, collapsed under "Show completed" disclosure
- Group header shows: project name + count of open todos in that group

**Grouping options** (toggle control):
- "By project" (default): group by project name alphabetically
- "By file": group by file path

**Mark done flow** (OPTIMISTIC UPDATE):
1. User clicks checkbox
2. Immediately update local state — flip todo.done = true, move to completed group
3. Call `PATCH /api/todos/:id` with `{ done: true }` in background
4. On error: roll back the state change + show brief error toast ("Failed to save — reverted")
5. On success: nothing extra needed (state already updated)

**Why optimistic**: Reduces perceived latency for the most common action (marking done).

### `src/hooks/useTodos.ts`
```ts
export function useTodos() {
  // returns { todos: Todo[], loading: boolean, error: string | null, toggle: (id: string) => void, refetch: () => void }
  // toggle() is the optimistic update function
}
```

### Error + loading states
- Loading: skeleton rows with `animate-pulse`
- Error: error message with retry button
- Empty: "No open TODOs — you're all caught up! 🎉"
- Toast: simple fixed bottom-left message, fades out after 3s (CSS transition, no animation lib)

## Acceptance Criteria
- [ ] Todos display grouped by project by default
- [ ] Clicking checkbox updates UI immediately (optimistic)
- [ ] PATCH request fires after click
- [ ] On PATCH failure, state reverts + toast shown
- [ ] Toggle between "by project" and "by file" grouping works
- [ ] Completed todos collapsible under "Show completed"
- [ ] FIXME/HACK todos show type badge
- [ ] Loading skeleton renders while fetching
- [ ] `pnpm type-check` passes
- [ ] `pnpm test` passes (toggle optimism, grouping logic unit tested)

## Validation Gates
- [ ] `pnpm type-check` → zero errors
- [ ] `pnpm test` → all tests green

## Constraints
- Do NOT implement server-sent events or websockets — polling only (polling wired in TASK-011)
- Do NOT use any external UI component library — Tailwind only
- Do NOT re-fetch todos after every toggle (wasteful) — local state update is enough
- Type `Todo` should live in `src/types.ts` (shared with other components)
- The toast must be CSS-only (no React state animation library)

## On Completion
```
git add -A
git commit -m "feat(TASK-008): todo aggregator component with optimistic toggle"
```

Update `.agents/state.json` tasks.TASK-008.status to "done".
