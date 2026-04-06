# Handoff: Frontend — Dashboard layout and project cards
**Task ID**: TASK-007
**Mode**: autonomous (no user interaction available)

## Context

**Project**: Cortex — local-only personal command center. React+Vite+TypeScript frontend on :5173, Express.js backend on :3001.

**This task builds on TASK-001 (scaffold) and TASK-003 (backend project scanner)**. The backend already has `GET /api/projects` returning an array of Project objects. You're building the React frontend shell and the project cards component.

**Tailwind CSS version matters**: This repo uses Tailwind CSS v4. Import it with `@import "tailwindcss"` in the CSS file — NOT `@tailwind base; @tailwind components; @tailwind utilities;`. Do not add tailwind.config.js — v4 uses zero-config.

**API response shape** from `GET /api/projects`:
```ts
interface Project {
  name: string            // folder name
  path: string            // absolute path
  status: 'active' | 'stale' | 'archived' | 'unknown'
  lastModified: string    // ISO date string
  staleDays: number       // days since last modification
  summary: string         // first meaningful line of state file
  nextSteps: string[]     // extracted next action items
  todos: number           // total open TODO count
  openTodos: number       // same (alias)
  hasDeadlines: boolean
}
```

## Task

Build the main dashboard layout and the project card grid component.

### `src/App.tsx` — outer shell
- Top bar with "Cortex" title (left) + current date (right)
- QuickCapture bar slot at top (renders `<QuickCapture />` — use null/placeholder for now if component doesn't exist yet)
- Two-column grid: left = stats bar + project card grid; right = sidebar (TODO aggregator + deadline timeline) 
- Mobile-first: cards stack at small breakpoints
- Stats: active projects count, total open TODOs, stale count
- `useEffect` fetches `GET /api/projects` on mount, stores in state

### `src/components/ProjectCard.tsx`

```tsx
interface ProjectCardProps {
  project: Project
}
```

- White card with subtle border, hover shadow (`hover:shadow-md`)
- **Status badge** top-right corner: 
  - `active` → green badge
  - `stale` → amber badge  
  - `archived` → gray badge
  - `unknown` → gray badge
- Project name (bold, large)
- Summary text (text-gray-600, truncated to 2 lines with `line-clamp-2`)
- Next steps list (max 3 items, bullet points, text-sm)
- Footer row: last modified date (relative, e.g. "3 days ago"), TODO count chip
- **"Open in VS Code" button**: `<a href={`vscode://file/${project.path}`}>Open</a>` — opens VS Code at folder  
- Stale indicators: amber border if staleDays > 14, red border if staleDays > 30

### `src/components/StatusOverview.tsx`

- Stats bar showing: # active, # stale, # archived, total open TODOs
- Colorful pill badges, one-line summary row
- Appears above the project card grid

### Fetch hook: `src/hooks/useProjects.ts`

```ts
export function useProjects() {
  // returns { projects: Project[], loading: boolean, error: string | null, refetch: () => void }
  // fetches from http://localhost:3001/api/projects
  // handles loading + error states
}
```

### Error and loading states
- Loading: render project card skeleton (3 placeholder cards with `animate-pulse`)
- Error: red banner with error message and retry button
- Empty: "No projects found" message with path shown

## Acceptance Criteria
- [ ] Dashboard renders without errors
- [ ] Project cards display: name, status badge, summary, next steps, open todos count
- [ ] Status badge colors correct (green/amber/gray)
- [ ] "Open in VS Code" link renders with correct `vscode://file/...` URL
- [ ] Stale cards show amber border (>14d) or red border (>30d)
- [ ] Loading skeleton renders while fetching
- [ ] Error state shows retry button
- [ ] StatusOverview shows count summaries
- [ ] `pnpm type-check` passes
- [ ] `pnpm test` passes (basic render tests)

## Validation Gates
- [ ] `pnpm type-check` → zero errors
- [ ] `pnpm test` → all tests green
- [ ] `pnpm dev` → frontend loads at localhost:5173 without console errors

## Constraints
- Do NOT use any CSS files except for Tailwind's `@import "tailwindcss"` pattern
- Do NOT use any date library — use vanilla JS Date math for relative time
- Do NOT hardcode the backend URL — use `const API = 'http://localhost:3001'` defined once
- Do NOT add router/navigation — single page app only
- Keep types in a shared `src/types.ts` file that can be imported across components

## On Completion
```
git add -A
git commit -m "feat(TASK-007): dashboard layout and project cards frontend"
```

Update `.agents/state.json` tasks.TASK-007.status to "done".
