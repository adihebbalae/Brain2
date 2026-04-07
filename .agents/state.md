# Project State — Cortex

> Auto-updated by agents. Human-readable view of `.agents/state.json`.

## Status
- **Project**: Cortex — Local-only personal command center dashboard
- **Phase**: MVP Complete ✅ — smoke tested, security cleared, ready to push
- **Current Task**: None — P0 complete, P1 handoffs generated
- **Blocked On**: None
- **Security**: Cleared for push ✅
- **Recent Completions**: 
  - TASK-001 — Project scaffolding complete (React+Vite+Express+TypeScript+Tailwind)
  - TASK-003 — Project scanner with state file parser (17 tests passing)
  - TASK-004 — TODO extractor with checkbox write-back (22 tests passing)
  - TASK-005 — Deadline reader with urgency calculation (22 tests passing)
  - TASK-006 — Quick capture endpoint + notes corpus parser (24 tests passing)
  - TASK-007 — Dashboard layout with project cards (14 frontend tests, 99 total passing)
  - TASK-008 — TODO aggregator with optimistic updates (21 frontend tests, 120 total passing)
  - TASK-009 — Deadline timeline with urgency indicators (17 frontend tests, 137 total passing)
  - TASK-010 — Quick capture input bar component (20 component tests, 157 total passing)

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
- Ollama (llama3.1:8b) for AI summarization — local, no API key (P1)
- ntfy.sh for push notifications — no OAuth, single HTTP POST (P1)
- Google Calendar dropped in favour of ntfy simplicity

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
| TASK-008 | Frontend: TODO aggregator | done | P0 |
| TASK-009 | Frontend: Deadline timeline | done | P0 |
| TASK-010 | Frontend: Quick capture bar | done | P0 |
| TASK-011 | Integration + E2E testing | done | P0 |
| TASK-012 | ntfy push notifications (deadlines + stale + digest) | pending | P1 |
| TASK-013 | Ollama AI summarization (llama3.1:8b, auto on load) | pending | P1 |
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
- 2026-04-05: TASK-008 completed — Built TodoAggregator component with optimistic updates:
  - TodoAggregator component displays TODOs grouped by project (default) or file with collapsible group headers
  - Each group header shows project/file name + count of open TODOs in that group
  - Each todo item: checkbox + text + file chip (truncated path:line) + type badge (FIXME/HACK only)
  - Completed todos shown with strikethrough under "Show completed" disclosure (collapsed by default)
  - Grouping toggle: "By project" (default) or "By file" buttons
  - Optimistic checkbox toggle: immediate UI update → PATCH /api/todos/:id in background → rollback on error with toast
  - useTodos custom hook: manages todo state, loading/error states, optimistic toggle with rollback, refetch function
  - Error handling: rollback state + CSS-only toast notification (fixed bottom-left, fade-in animation, auto-dismiss after 3s)
  - Loading state: 5 skeleton rows with animate-pulse
  - Error state: red banner with error message and retry button
  - Empty state: "No open TODOs — you're all caught up! 🎉"
  - Todo type interface added to src/types.ts (id, text, done, file, line, project, type)
  - File path truncation: shows ".../<last-two-parts>" for long paths
  - CSS fade-in animation in src/index.css for toast
  - 21 frontend tests: 8 useTodos hook tests (fetch, toggle, optimistic update, rollback, refetch) + 13 TodoAggregator component tests (grouping, collapsing, completed disclosure, badges, toggle)
  - 120 total tests passing (85 backend + 35 frontend)
  - Type-checking passes with zero errors, all acceptance criteria met
- 2026-04-05: TASK-009 completed — Built DeadlineTimeline component with timeline visualization:
  - DeadlineTimeline component displays deadlines in vertical timeline layout with date column (month + day + relative label), connector line with colored dots, description column
  - Color-coded urgency indicators: red (≤2 days, bold text, red dot, red border), amber (≤7 days, amber dot, amber border), green (>7 days, green dot, green border), gray (completed, gray dot, strikethrough)
  - Relative date labels: "Today", "Tomorrow", "N days", "Yesterday", "N days ago" for dates within 7 days
  - Tag chips: small gray badges when tag is present (bg-gray-100, text-gray-600)
  - Compact mode: shows max 5 pending deadlines + "See all N deadlines" link when more exist
  - Completed deadlines section: appears at bottom after "Completed" divider with gray styling and strikethrough
  - useDeadlines custom hook: fetches GET /api/deadlines with loading/error/refetch states
  - Loading state: 3 skeleton rows with animate-pulse
  - Error state: red banner with error message and retry button
  - Empty state: "📅 No upcoming deadlines" with calendar emoji
  - Deadline interface added to src/types.ts (id, date, description, tag, done, urgency)
  - No external date libraries (vanilla JS Date only)
  - Urgency driven by API field (not recalculated client-side)
  - 17 frontend tests: 5 useDeadlines hook tests (fetch, error, refetch) + 12 DeadlineTimeline component tests (rendering, urgency styling, relative labels, compact mode, completed section)
  - 137 total tests passing (85 backend + 52 frontend)
  - Type-checking passes with zero errors, all acceptance criteria met
- 2026-04-05: TASK-010 completed — Built QuickCapture component for quick thought capture:
  - QuickCapture component: full-width input bar positioned at top of dashboard (above all content)
  - White background with subtle bottom shadow, persistent across all views
  - Input field with placeholder "Capture a thought... (Ctrl+K)", maxLength 2000 characters
  - Submit button on right ("Capture"), disabled when input is empty/whitespace-only or during submission
  - Form submission: POST to /api/capture endpoint with { text: string } payload
  - Input sanitization: trims whitespace, rejects blank strings
  - Success behavior: clears input field + shows green "Captured!" toast (auto-dismiss after 2 seconds with CSS fade-in animation)
  - Error behavior: keeps input unchanged + shows red toast with API error message
  - Loading state: disables input and button during submission, changes button text to "Capturing..."
  - Ctrl+K keyboard shortcut: focuses capture input from anywhere on the page (with preventDefault)
  - Event listener cleanup on component unmount (no memory leaks)
  - onCapture callback: optional prop for parent component to trigger data refetch after successful capture
  - Integrated into App.tsx: replaces placeholder, passes refetch callback to refresh project data
  - State-based toast implementation: no external notification library, CSS-only with existing animate-fade-in class
  - 20 component tests covering: input/button rendering, enable/disable states, submit on button click, submit on Enter key, input clearing, success/error toasts, whitespace trimming, blank input rejection, Ctrl+K shortcut, preventDefault behavior, onCapture callback, loading states, maxLength enforcement, auto-dismiss toast, event listener cleanup
  - 157 total tests passing (85 backend + 72 frontend)
  - Type-checking passes with zero errors, all acceptance criteria met
- 2026-04-05: TASK-011 completed — **MVP COMPLETE** — Full integration with polling, error boundaries, and E2E testing:
  - **Polling**: Added 60-second auto-refresh to all data hooks (useProjects, useTodos, useDeadlines) with proper cleanup on unmount
  - **Full Layout**: Wired TodoAggregator and DeadlineTimeline into App.tsx with responsive two-column layout (projects left, deadlines + todos right)
  - **Error Boundaries**: Created ErrorBoundary component (React class-based) to catch and display component crashes gracefully with retry button
  - **QuickCapture Integration**: Triggers both project and todo refetch on successful capture
  - **Integration Test Suite**: Created server/integration.test.ts with 26 comprehensive tests validating:
    - Project scanner discovers all 3 test projects with correct state file priority (agent_state.md > state.md > README.md)
    - Status extraction from frontmatter, summary from content, next steps from checkboxes
    - TODO extraction finds all 5 pattern types (unchecked/checked checkboxes, TODO/FIXME/HACK comments)
    - File path and line numbers included for all todos
    - Checkbox write-back toggles in source file (verified by reading file content after toggle)
    - Rejection of toggle for non-checkbox types (TODO/FIXME/HACK)
    - Deadline parsing with urgency calculation (red ≤2d, amber ≤7d, green >7d, gray completed)
    - Tag parsing, completed deadline handling
    - Quick capture appends to inbox with timestamp format
    - Performance benchmarks: deadlines < 3s, capture < 5s
    - Full offline operation verified (no external network calls)
  - **Test Updates**: Updated App.test.tsx to mock all three API endpoints (projects, todos, deadlines)
  - **New Files**: src/components/ErrorBoundary.tsx, server/integration.test.ts
  - **All PRD Success Criteria Met**:
    ✅ Today's most pressing deadlines visible within 3 seconds
    ✅ Mark any TODO done permanently updates source file
    ✅ Quick capture → visible in vault within 5 seconds
    ✅ All project statuses visible in one view
    ✅ Works fully offline (no external network calls)
  - **183 total tests passing** (85 backend unit + 26 integration + 72 frontend), type-check clean
  - **Status**: mvp_complete
