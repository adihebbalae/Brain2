# Handoff: Zen/Focus Mode with Pomodoro Timer
**Task ID**: TASK-041
**Mode**: autonomous (no user interaction available)

## Context

**Project**: Cortex — local-only personal command center dashboard. React+Vite+TypeScript frontend on :5173, Express.js TypeScript backend on :3001. Repo at `C:\Users\boomb\Documents\_Projects\Brain2`.

**What exists**: Multi-page routing (TASK-032) with pages: Home, Projects, Deadlines, Knowledge, Learning. TODO extraction (TASK-004) with GET /api/todos returning all TODOs across projects. Checkbox toggling via PATCH /api/todos/:id.

## Task

### 1. Create FocusMode component (`src/pages/FocusMode.tsx`)

A full-screen, distraction-free view with:
- **Dark background** (`bg-gray-900` or darker)
- **Project name** at top (from slug param)
- **Pomodoro timer**: Large digits showing `MM:SS`, centered
  - States: WORK (25min), SHORT_BREAK (5min), LONG_BREAK (15min)
  - Cycle: work → short → work → short → work → long → repeat
  - Controls: Start, Pause, Reset buttons
  - Use `useState` for time remaining + `useEffect` with `setInterval` (cleanup on unmount!)
  - On timer completion: play a short beep using Web Audio API (synthesize a 440Hz tone for 200ms, no external files)
- **TODO list**: Filtered client-side from GET /api/todos where `todo.project` matches the slug
  - Checkboxes call PATCH /api/todos/:id to toggle
- **"Exit Focus" button**: `useNavigate(-1)` to go back

### 2. Add route to App.tsx

```tsx
<Route path="/focus/:slug" element={<FocusMode />} />
```

### 3. Hide NavBar in focus mode

In App.tsx or NavBar component, check if current route matches `/focus/*` and hide the NavBar. Use `useLocation()` from react-router.

### 4. Add "Focus" button to ProjectDetailView

On the project detail page, add a button/link that navigates to `/focus/${slug}`.

### 5. Run tests and commit

- `npm test -- --reporter=dot`
- `npx tsc --noEmit`
- `git add -A && git commit -m "feat(TASK-041): zen/focus mode with pomodoro timer"`

## Acceptance Criteria
- [ ] `/focus/:slug` route renders with project-scoped TODOs
- [ ] Pomodoro timer counts down 25:00 → 0:00 with start/pause/reset controls
- [ ] Timer cycles: work (25min) → short break (5min) → work → short break → work → long break (15min)
- [ ] Audio beep on timer completion (Web Audio API, no files)
- [ ] Checkbox toggles still call PATCH /api/todos/:id
- [ ] NavBar hidden in focus mode
- [ ] "Exit Focus" navigates back to previous page
- [ ] Frontend-only — no backend changes needed
- [ ] Tests for timer logic and route rendering

## Validation Gates
- [ ] `npm test -- --reporter=dot` passes
- [ ] `npx tsc --noEmit` no new errors
- [ ] `git commit` done

## Files to Read First
- `src/App.tsx` — routing setup
- `src/components/NavBar.tsx` — to hide in focus mode
- `src/pages/ProjectDetailView.tsx` — to add Focus button
- `src/hooks/useTodos.ts` — existing TODO fetching hook (if it exists)

## Constraints
- Frontend-only — do NOT create any new backend routes
- Do NOT install any new npm packages
- Use Web Audio API for the beep, not an audio file
- Timer must clean up setInterval on unmount (no memory leaks)
- Do NOT ask questions — make reasonable assumptions and document them
