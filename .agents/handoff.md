# Handoff: Frontend — Deadline timeline
**Task ID**: TASK-009
**Mode**: autonomous (no user interaction available)

## Context

**Project**: Cortex — local-only personal command center. React+Vite+TypeScript frontend on :5173, Express backend on :3001.

**Depends on TASK-005 (backend deadline reader)**. The backend has `GET /api/deadlines` returning deadlines parsed from `VAULT_DIR/deadlines.md`.

**API shape**:
```ts
// GET /api/deadlines response
interface Deadline {
  id: string       // generated ID
  date: string     // ISO date string e.g. "2026-04-10"
  description: string
  tag: string | null
  done: boolean
  urgency: 'red' | 'amber' | 'green' | 'gray'
  // urgency rules:
  //   red   = due within 2 days (and not done)
  //   amber = due within 7 days (and not done)
  //   green = due > 7 days (and not done)
  //   gray  = done
}
```

## Task

Build `src/components/DeadlineTimeline.tsx`.

### Component interface
```tsx
interface DeadlineTimelineProps {
  compact?: boolean   // true = show max 5 upcoming, false = show all
}
```

### Visual design

**Timeline layout**:
- Vertical list, chronological order (nearest date first)
- Left column: date display (month + day, relative label for "Today", "Tomorrow", "2 days")
- Connector line between items (thin vertical line with dot at each item)
- Right column: description + optional tag chip

**Color coding** by urgency:
- `red` → red dot + red border-left on the item row, description in bold
- `amber` → amber/yellow dot + amber border-left
- `green` → green dot, normal text
- `gray` (done) → gray dot, strikethrough description, reduced opacity

**Tags**:
- Render as small chip/badge if present: `bg-gray-100 text-gray-600 text-xs px-2 py-0.5 rounded`

**Compact mode** (`compact=true`):
- Show only next 5 pending deadlines
- Show "See all N deadlines" link at bottom if there are more

**Completed deadlines**:
- Appear at the bottom, after a "Completed" divider
- Strikethrough + reduced opacity

**Empty state**: "No upcoming deadlines" with a small calendar icon (use text: 📅)

### `src/hooks/useDeadlines.ts`
```ts
export function useDeadlines() {
  // returns { deadlines: Deadline[], loading: boolean, error: string | null, refetch: () => void }
}
```

### Loading / error states
- Loading: 3 skeleton rows with `animate-pulse`
- Error: inline "Failed to load deadlines" with retry link

## Acceptance Criteria
- [ ] Deadlines render in chronological order (pending, then completed)  
- [ ] Red deadlines show red left border and bold text
- [ ] Amber deadlines show amber/yellow left border
- [ ] Completed deadlines show with strikethrough + gray at bottom
- [ ] Tags render as chips when present
- [ ] Compact mode shows max 5 + "See all" link when >5
- [ ] "Today" / "Tomorrow" / "2 days" relative labels for near dates
- [ ] Empty state renders when no deadlines
- [ ] Loading skeleton renders
- [ ] `pnpm type-check` passes
- [ ] `pnpm test` passes (sorting logic, urgency display, compact mode unit tested)

## Validation Gates
- [ ] `pnpm type-check` → zero errors
- [ ] `pnpm test` → all tests green

## Constraints
- Do NOT import any date manipulation libraries — use vanilla JS Date
- Do NOT make the deadline clickable yet (no edit UI in scope)
- Urgency coloring must be driven by the `urgency` field from the API, not recalculated client-side
- Type `Deadline` should live in `src/types.ts`
- No external icon library — use emoji or SVG inline if needed

## On Completion
```
git add -A
git commit -m "feat(TASK-009): deadline timeline component"
```

Update `.agents/state.json` tasks.TASK-009.status to "done".
