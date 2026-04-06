# Project State — Cortex

> Auto-updated by agents. Human-readable view of `.agents/state.json`.

## Status
- **Project**: Cortex — Local-only personal command center dashboard
- **Phase**: In Progress — Frontend implementation started, dashboard shell complete
- **Current Task**: TASK-007 — Frontend dashboard layout and project cards (done)
- **Blocked On**: None
- **Recent Completions**: 
  - TASK-001 — Project scaffolding complete (React+Vite+Express+TypeScript+Tailwind)
  - TASK-003 — Project scanner with state file parser (17 tests passing)
  - TASK-004 — TODO extractor with checkbox write-back (22 tests passing)
  - TASK-005 — Deadline reader with urgency calculation (22 tests passing)
  - TASK-006 — Quick capture endpoint + notes corpus parser (24 tests passing)
  - TASK-007 — Dashboard layout with project cards (14 frontend tests, 99 total passing)

## Project Brief

**Product**: Cortex — a local-only personal command center that aggregates projects, deadlines, TODOs, and knowledge into a single web dashboard running on localhost.

**User**: Adi — solo developer managing multiple side projects across `C:\Users\boomb\Documents\_Projects`, with deadlines from school, tutoring, and personal work.

**Problem**: Project state scattered across dozens of folders, unstructured notes, Google Calendar, Apple Reminders. No single view of what's active, stale, due, or next.

**Stack**: React + Vite + TypeScript, Tailwind CSS, Express.js (TS), pnpm

**Paths**:
- Projects: `C:\Users\boomb\Documents\_Projects`
- Vault: `C:\Users\boomb\Documents\SecondBrain`
- Notes corpus: `C:\Users\boomb\Documents\notes_corpus.txt.txt`

**Architecture Decisions**:
- Brain2 repo IS the dashboard (config-driven paths via .env)
- Single package with concurrently for dev
- Claude API direct (no abstraction)
- Google Calendar deferred to P1

## Task Summary

| ID | Title | Status | Priority |
|----|-------|--------|----------|
| TASK-001 | Scaffold project | done | P0 |
| TASK-002 | Obsidian vault PARA structure | done | P0 |
| TASK-003 | Backend: Project scanner | done | P0 |
| TASK-004 | Backend: TODO extractor | done | P0 |
| TASK-005 | Backend: Deadline reader | done | P0 |
| TASK-006 | Backend: Quick capture + notes parser | done | P0 |
| TASK-007 | Frontend: Dashboard + project cards | done | P0 |
| TASK-008 | Frontend: TODO aggregator | pending | P0 |
| TASK-009 | Frontend: Deadline timeline | pending | P0 |
| TASK-010 | Frontend: Quick capture bar | pending | P0 |
| TASK-011 | Integration + E2E testing | pending | P0 |
| TASK-012 | Google Calendar OAuth + sync | pending | P1 |
| TASK-013 | AI summarization (Claude API) | pending | P1 |
| TASK-014 | Chat export viewer | pending | P1 |

## Changelog
- 2026-04-05: init-project — PRD ingested, plan approved, project scaffolded by manager
- 2026-04-05: TASK-002 completed — Created SecondBrain Obsidian vault with full PARA structure:
  - 8 directories: .obsidian, Inbox, Projects, Areas, Resources, Archive, ChatExports, Deadlines, DailyNotes
  - Template files: deadlines.md (with sample deadlines), inbox.md, areas.md
  - 12 project junctions from Projects/ to C:\Users\boomb\Documents\_Projects\*
  - All validation gates passed successfully
- 2026-04-05: TASK-001 completed — Scaffolded Cortex application:
  - React+Vite+TypeScript frontend with Tailwind CSS
  - Express.js TypeScript backend with CORS
  - Vitest testing framework configured
  - Concurrently dev scripts (frontend :5173, backend :3001)
  - All config files created (tsconfig, vite, tailwind, postcss)
  - TypeScript type-checking passes with zero errors
- 2026-04-05: TASK-003 completed — Implemented project scanner and state file parser:
  - State file priority detection (agent_state.md > Agent_State.json > state.md > Status.md > README.md)
  - Status inference from content keywords and frontmatter
  - Stale threshold calculation (>14 days = stale)
  - Summary extraction from ## Summary/Overview/Status sections
  - Next steps extraction from ## Next Steps/TODO sections and unchecked items
  - Path traversal protection (validates all paths are inside PROJECTS_DIR)
  - GET /api/projects endpoint returning sorted array of projects
  - 17 unit tests with temporary filesystem mocking (all passing)
  - Type-checking passes, all acceptance criteria met
- 2026-04-05: TASK-004 completed — Implemented TODO extractor with checkbox write-back:
  - Extract 5 pattern types: - [ ] (unchecked), - [x] (checked), TODO:, FIXME:, HACK:
  - Stable hash-based IDs using SHA-256 (first 16 hex chars)
  - Recursive markdown scanning of both PROJECTS_DIR and VAULT_DIR
  - Skips node_modules/, .git/, and files >1MB
  - Atomic file write-back using temp file + rename pattern
  - Path traversal protection (validates all paths within allowed directories)
  - GET /api/todos endpoint (returns total, completed, byProject grouping)
  - PATCH /api/todos/:id endpoint (toggle checkboxes only, rejects TODO/FIXME/HACK comments)
  - 22 unit tests with temporary filesystem (all passing)
  - Type-checking passes with zero errors, all acceptance criteria met
- 2026-04-05: TASK-005 completed — Implemented deadline reader with urgency calculation:
  - Parses VAULT_DIR/Deadlines/deadlines.md format: - [ ] YYYY-MM-DD | Description | optional-tag
  - Urgency calculation based on days until due date: red (≤2 days), amber (≤7 days), green (>7 days), gray (completed)
  - Stable ID generation using SHA-256 (first 12 hex chars)
  - Sort order: pending items ascending by date, completed items at end descending by date
  - Graceful handling of missing file (returns empty array, not error)
  - Path validation for security (ensures path within vault directory)
  - GET /api/deadlines endpoint mounted in server/index.ts
  - 22 unit tests covering parsing, urgency thresholds, sorting, edge cases (all passing)
  - Type-checking passes with zero errors, all acceptance criteria met
- 2026-04-05: TASK-006 completed — Implemented quick capture endpoint and notes corpus parser:
  - POST /api/capture appends timestamped entries to VAULT_DIR/Inbox/inbox.md in format: - [ ] [YYYY-MM-DD HH:mm] text
  - Input validation: non-empty string, max 2000 characters
  - Input sanitization: strips newlines, control characters (null bytes, etc.)
  - Auto-creates Inbox directory and inbox.md file if they don't exist
  - Trimming whitespace from captured text
  - GET /api/capture/corpus parses notes_corpus.txt.txt for actionable items with heuristic type detection:
    - type='todo': checkbox patterns (- [ ], [ ], * [ ], • [ ]), TODO/FIXME/HACK comments
    - type='idea': idea: prefix, idea -, IDEA: patterns
    - type='note': fallback for general content (min 10 chars)
    - Filters: skips blank lines, punctuation-only lines, short lines (<10 chars), header lines (all-caps short strings)
  - Stable ID generation using SHA-256 (first 16 hex chars)
  - Graceful handling of missing corpus file (returns empty array)
  - Path validation for security
  - 24 unit tests: 9 capture writer tests + 15 corpus parser tests (all passing)
  - Type-checking passes with zero errors, all acceptance criteria met
- 2026-04-05: TASK-007 completed — Built frontend dashboard layout and project cards:
  - Main dashboard layout with header (Cortex title + current date), QuickCapture placeholder, two-column responsive grid
  - StatusOverview component: stats bar showing active/stale/archived project counts, total open TODOs
  - ProjectCard component: displays name, color-coded status badge (green/amber/gray), summary (2-line truncate), next steps (max 3), last modified (relative time), TODO count, "Open in VS Code" button with vscode:// protocol links
  - Stale indicators: amber border for >14 days, red border for >30 days
  - useProjects custom hook: fetches GET /api/projects with loading/error/refetch states
  - Error state: red banner with retry button
  - Loading state: 3 skeleton cards with animate-pulse
  - Empty state: "No projects found" message
  - Installed @testing-library/react and happy-dom for component testing
  - 14 frontend tests: 5 App tests (loading/error/empty states, StatusOverview rendering) + 9 ProjectCard tests (status badges, stale borders, next steps truncation, Open in VS Code link)
  - 99 total tests passing (85 backend + 14 frontend)
  - Type-checking passes with zero errors, all acceptance criteria met
