# Project State — Cortex

> Auto-updated by agents. Human-readable view of `.agents/state.json`.

## Status
- **Project**: Cortex — Local-only personal command center dashboard
- **Phase**: Planning Complete — TASK-002 done, TASK-001 blocked
- **Current Task**: TASK-001 — Scaffold project (blocked after 3 attempts)
- **Blocked On**: TASK-001 failed after 3 attempts
- **Recent Completion**: TASK-002 — Obsidian vault PARA structure created successfully

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
| TASK-001 | Scaffold project | blocked | P0 |
| TASK-002 | Obsidian vault PARA structure | done | P0 |
| TASK-003 | Backend: Project scanner | pending | P0 |
| TASK-004 | Backend: TODO extractor | pending | P0 |
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
