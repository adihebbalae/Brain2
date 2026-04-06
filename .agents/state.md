# Project State — Cortex

> Auto-updated by agents. Human-readable view of `.agents/state.json`.

## Status
- **Project**: Cortex — Local-only personal command center dashboard
- **Phase**: In Progress — Backend implementation underway
- **Current Task**: TASK-004 — Backend TODO extractor (done)
- **Blocked On**: None
- **Recent Completions**: 
  - TASK-001 — Project scaffolding complete (React+Vite+Express+TypeScript+Tailwind)
  - TASK-003 — Project scanner with state file parser (17 tests passing)
  - TASK-004 — TODO extractor with checkbox write-back (22 tests passing)

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
| TASK-005 | Backend: Deadline reader | pending | P0 |
| TASK-006 | Backend: Quick capture + notes parser | pending | P0 |
| TASK-007 | Frontend: Dashboard + project cards | pending | P0 |
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
