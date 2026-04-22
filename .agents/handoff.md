╔══════════════════════════════════════════════════════════════╗
║  SWITCH TO:  @engineer   |   MODEL:  Sonnet                ║
╚══════════════════════════════════════════════════════════════╝

# Handoff: TASK-034 — Electron Desktop Application
**From**: Manager → **To**: Engineer | **Model**: Sonnet
**Date**: 2026-04-21 | **Task ID**: TASK-032

## Context

Cortex is a local-only personal command center dashboard (Brain2 repo). The multi-page
dashboard restructure (TASK-032) is 95% complete:
- All 5 page components live: HomePage, ProjectsPage, DeadlinesPage, KnowledgePage, LearningPage
- NavBar.tsx handles state-based routing (no react-router-dom — simpler approach, same UX)
- ProjectDetailView.tsx is an inline panel inside ProjectsPage (receives Project as prop)
- App.tsx wired: NavBar + QuickCapture persistent + all pages + BrainChat overlay
- POST /api/deadlines and DELETE /api/deadlines/:id routes exist and work
- addDeadline() and removeDeadline() functions live in server/lib/deadline-reader.ts

**The only remaining gap**: No tests exist for the new write-back functions or route handlers.
- `server/lib/deadline-reader.test.ts` does NOT cover `addDeadline` or `removeDeadline`
- No `server/routes/deadlines.test.ts` file exists at all

All 587 existing tests pass. This task adds the missing test coverage.

## Task

### 1. Extend `server/lib/deadline-reader.test.ts`

Add tests for `addDeadline` and `removeDeadline`. Use `fs.mkdtemp` (or `tmp`) for
temp directories — follow the pattern already in this file.

**Tests for `addDeadline`:**
- Appends correctly formatted line `- [ ] YYYY-MM-DD | Description` to deadlines.md
- Appends with optional tag: `- [ ] YYYY-MM-DD | Description | tag`
- Creates `Deadlines/` directory and `deadlines.md` when they don't exist
- Returns a `DeadlineItem` with correct `id`, `date`, `description`, `urgency`, `daysUntil`
- Sanitizes pipe characters in description (replaces `|` with `-`)
- Throws on invalid date format (e.g. `"not-a-date"`)

**Tests for `removeDeadline`:**
- Returns `true` and removes the correct line when a matching ID is found
- Returns `false` when no matching ID exists in any vault dir
- Scans multiple vault dirs (passes array, first match wins)
- Leaves other deadline lines intact after removal
- Handles missing `deadlines.md` gracefully (skips, does not throw)

### 2. Create `server/routes/deadlines.test.ts`

New route test file. Mock `'../lib/deadline-reader.js'` and `'../lib/vault-config.js'`.
Use supertest. Follow the pattern in `server/routes/reading.test.ts` or `server/routes/review.test.ts`.

**Tests for `POST /api/deadlines`:**
- Returns 201 + DeadlineItem body on valid `{ date, description }` input
- Returns 201 with optional `tag` included
- Returns 400 when `date` is missing or malformed (not YYYY-MM-DD)
- Returns 400 when `description` is missing or empty string
- Returns 500 when `VAULT_DIR` env var is not set (unset it in the test)

**Tests for `DELETE /api/deadlines/:id`:**
- Returns 200 `{ success: true }` when deadline is found and removed
- Returns 404 when deadline ID not found (`removeDeadline` returns false)
- Returns 400 when ID format is invalid (e.g. `"abc"` — not 12-char hex)
- Returns 500 when `VAULT_DIR` env var is not set

## Files to Read First

- [server/lib/deadline-reader.ts](server/lib/deadline-reader.ts) — `addDeadline` (line ~163) and `removeDeadline` (line ~200) implementations
- [server/lib/deadline-reader.test.ts](server/lib/deadline-reader.test.ts) — existing test patterns and temp dir setup
- [server/routes/deadlines.ts](server/routes/deadlines.ts) — the two new route handlers to understand what to mock
- [server/routes/reading.test.ts](server/routes/reading.test.ts) — reference pattern for route tests with mocked lib

## Acceptance Criteria

- [ ] `addDeadline` tests: at least 6 cases, all passing
- [ ] `removeDeadline` tests: at least 5 cases, all passing
- [ ] `server/routes/deadlines.test.ts` created with at least 9 route tests, all passing
- [ ] `npm test -- --reporter=dot` shows all tests passing (587 + new tests)
- [ ] `npx tsc --noEmit` — zero errors
- [ ] Update `.agents/state.json`: set `TASK-032.status` to `"done"`, add `"completed_at": "2026-04-21"`
- [ ] Append to `state.json` changelog: `"2026-04-21: TASK-032 completed — Multi-page dashboard fully live. Added N tests for addDeadline, removeDeadline, and deadline POST/DELETE routes. XXX total tests passing."`

## Constraints

- Do NOT modify any production source files — tests only in this task
- Do NOT install new packages — vitest + supertest already available
- Do NOT add `GET /api/projects/:slug` — ProjectDetailView receives project as prop from ProjectsPage (no URL routing needed; design decision already made)
- When mocking vault-config.js in route tests, mock `getVaultDirs` to return a temp array and `getPrimaryVaultDir` if needed
