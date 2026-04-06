# Module Registry — Cortex

> Auto-maintained by Manager. Engineer updates Status and Last Updated on every commit.
> Manager reads this before every routing decision and updates after checkpoints.

---

## 1. Project Scanner
- **Status**: `not-started`
- **Files**: `server/lib/scanner.ts`, `server/lib/state-reader.ts`, `server/routes/projects.ts`
- **Depends On**: none
- **Owner**: engineer
- **Last Updated**: 2026-04-05
- **Notes**: Scans PROJECTS_DIR for state files, parses status/summary/next-steps, infers status from content

## 2. TODO System
- **Status**: `not-started`
- **Files**: `server/lib/todo-extractor.ts`, `server/routes/todos.ts`
- **Depends On**: none
- **Owner**: engineer
- **Last Updated**: 2026-04-05
- **Notes**: Extracts TODO/FIXME/HACK from all markdown, supports checkbox write-back to source files

## 3. Deadline System
- **Status**: `not-started`
- **Files**: `server/lib/deadline-reader.ts`, `server/routes/deadlines.ts`
- **Depends On**: none
- **Owner**: engineer
- **Last Updated**: 2026-04-05
- **Notes**: Parses deadlines.md, calculates urgency levels (red/amber/green/gray)

## 4. Quick Capture
- **Status**: `not-started`
- **Files**: `server/routes/capture.ts`
- **Depends On**: Vault (TASK-002 creates Inbox directory)
- **Owner**: engineer
- **Last Updated**: 2026-04-05
- **Notes**: Appends timestamped entries to inbox.md, one-time parse of existing notes_corpus.txt.txt

## 5. Frontend Dashboard
- **Status**: `not-started`
- **Files**: `src/` (App.tsx, components/ProjectCard, TodoAggregator, DeadlineTimeline, QuickCapture, StatusOverview)
- **Depends On**: All backend modules (consumes their APIs)
- **Owner**: engineer
- **Last Updated**: 2026-04-05
- **Notes**: React+Tailwind, grid layout, responsive, polling, error/empty states

## 6. AI Features (P1)
- **Status**: `not-started`
- **Files**: `server/routes/ai.ts`, `server/lib/ai-client.ts`
- **Depends On**: Project Scanner
- **Owner**: engineer
- **Last Updated**: 2026-04-05
- **Notes**: Claude API summarization, auto-TODO extraction from prose. Deferred to post-MVP.

## 7. Google Calendar (P1)
- **Status**: `not-started`
- **Files**: `server/lib/gcal-client.ts`, `server/routes/calendar.ts`
- **Depends On**: Deadline System
- **Owner**: engineer
- **Last Updated**: 2026-04-05
- **Notes**: OAuth2 flow, read-only, 14-day window, merged into deadline timeline. Deferred to post-MVP.

---

## Build Order

```
TASK-001 (scaffold) ──┬── TASK-003 (scanner) ──── TASK-007 (cards UI) ──┐
                      ├── TASK-004 (todos)   ──── TASK-008 (todo UI)   ─┤
                      ├── TASK-005 (deadlines)──── TASK-009 (timeline) ─┤── TASK-011 (integration)
TASK-002 (vault) ─────┤── TASK-006 (capture)  ──── TASK-010 (capture UI)┘         │
                      │                                                    ├── TASK-012 (calendar) P1
                      │                                                    ├── TASK-013 (AI) P1
                      │                                                    └── TASK-014 (exports) P1
```
