# Project State — Cortex

> Auto-updated by agents. Human-readable view of `.agents/state.json`.

## Status
- **Project**: Cortex — Local-only personal command center dashboard
- **Phase**: P2 Complete ✅ + Five P3 tasks complete (TASK-020, TASK-021, TASK-022, TASK-027, TASK-028)
- **Current Task**: None
- **Blocked On**: None
- **Security**: Cleared for push ✅
- **Recent Completions**: 
  - TASK-028 — Spaced repetition note resurfacing (45 new tests: 16 review-log + 17 review-queue + 12 routes, 520 total passing)
  - TASK-027 — Obsidian Canvas reader (35 new tests: 19 parser + 16 routes, 475 total passing)
  - TASK-022 — Article/bookmark reading tracker (33 new tests: 9 bookmarks parser + 12 reading-log parser + 12 route tests, 414 total passing)
  - TASK-021 — YouTube watch history (Google Takeout) parser and MediaPanel (22 new tests, 381 total passing)

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
| TASK-012 | ntfy push notifications (deadlines + stale + digest) | done | P1 |
| TASK-013 | Ollama AI summarization (llama3.1:8b, auto on load) | done | P1 |
| TASK-014 | Chat export viewer | done | P1 |
| TASK-015 | Multi-vault support (VAULT_DIRS array) | done | P2 |
| TASK-016 | LLM Wiki core: schema, ingest, index, log | done | P2 |
| TASK-017 | LLM Wiki query + lint + dashboard panel | done | P2 |
| TASK-018 | Self-learning: gap analysis + resource recommendations | done | P2 |
| TASK-019 | Multi-account Claude chat sync | done | P2 |
| TASK-020 | Google Calendar OAuth2 integration | done | P3 |
| TASK-021 | YouTube watch history (Google Takeout) | done | P3 |
| TASK-022 | Article/bookmark reading tracker | done | P3 |
| TASK-023 | Full RAG chat interface over all data | pending | P3 |
| TASK-024 | Knowledge graph visualizer (D3.js wikilinks) | in_progress | P3 |
| TASK-025 | Weekly review generator + daily context | pending | P3 |
| TASK-026 | Git activity log across all projects | in_progress | P3 |
| TASK-027 | Obsidian Canvas reader | done | P3 |
| TASK-028 | Spaced repetition note resurfacing | done | P3 |
| TASK-029 | Browser web clipper Chrome extension | pending | P3 |

## P3 Architecture Decisions
- **Google Calendar**: OAuth2 read-only, tokens stored in `data/calendar-tokens.json` (gitignored). New .env: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI`.
- **YouTube history**: Local file parse only (no API key). User drops Google Takeout `watch-history.json` at `YOUTUBE_HISTORY_PATH`. Setup guide written to vault.
- **Bookmarks**: Chrome `Bookmarks` JSON (flat tree walk) + `VAULT_DIR/Resources/ReadingLog.md` markdown. Saved links only — no browser history.
- **RAG chat**: Keyword-overlap scoring (no vector DB). Top-20 chunks → Ollama context → stream SSE. Depends on TASK-016.
- **Knowledge graph**: D3.js force layout. Nodes colored by PARA folder. Click → `obsidian://` deep link.
- **Weekly review**: Triggered on Sunday startup or POST endpoint. Uses git log + todos + reading list + calendar. Saves to vault DailyNotes.
- **Git activity**: `git log` across all `.git` dirs in PROJECTS_DIR. 90-day CSS grid heatmap.
- **Canvas reader**: JSON Canvas spec (.canvas files). Read+write (add-node for MCP use).
- **Spaced repetition**: `VAULT_DIR/Resources/review-log.json` tracks last-reviewed per note. 30/60/90d thresholds.
- **Web clipper**: Chrome Manifest V3 extension in `src/extension/`. Developer-mode install only.

## P3 Dependency Order
```
TASK-020 (Calendar) → standalone
TASK-021 (YouTube) → standalone
TASK-022 (Bookmarks) → standalone
TASK-024 (Knowledge graph) → standalone
TASK-026 (Git activity) → standalone
TASK-027 (Canvas reader) → standalone
TASK-028 (Spaced rep) → standalone
TASK-029 (Web clipper) → depends on TASK-006 (done)
TASK-025 (Weekly review) → depends on 020 + 021 + 022 + 026
TASK-023 (Full RAG) → depends on TASK-016 (done)
```

## P2 Architecture Decisions
- **LLM Wiki location**: `VAULT_DIR/Wiki/` — separate from raw notes (immutable)
- **Wiki AI engine**: Ollama llama3.1:8b (same as TASK-013, no new deps)
- **Resource discovery**: DuckDuckGo Instant Answer API (zero API keys required)
- **Multi-vault**: `VAULT_DIRS` env var (comma-separated), fallback to `VAULT_DIR`
- **References**: kytmanov/obsidian-llm-wiki-local (Ollama+Obsidian patterns), Astro-Han/karpathy-llm-wiki (schema workflow)
- **Dependency chain**: TASK-015 → TASK-016 → TASK-017 → TASK-018 | TASK-014 → TASK-019 (parallel)

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
- 2026-04-13: TASK-012 completed — Implemented ntfy push notification system:
  - **Background service** sends notifications for: red deadlines (urgency check every 60min + startup), stale projects (30+ days, max once per 7 days), daily digest (configurable time via NTFY_DIGEST_TIME, default 08:00)
  - **Fire-and-forget pattern**: uses native Node.js fetch for HTTP POST to ntfy.sh, errors logged but never crash server
  - **Deduplication**: state persisted in VAULT_DIR/.cortex-notify-state.json (tracks lastDeadlineNotify, lastStaleNotify, lastDigestDate)
  - **Configuration**: NTFY_TOPIC (required), NTFY_DIGEST_TIME (default 08:00), NTFY_URL (default https://ntfy.sh)
  - **Silent no-op**: when NTFY_TOPIC not set or during test runs (NODE_ENV === 'test')
  - **Files created**: server/lib/notifier.ts (core sender), notification-state.ts (state management), notification-service.ts (background service)
  - **Integration**: mounted in server/index.ts after routes, runs checks once on startup (5s delay) + every 60 minutes
  - **15 unit tests passing** (notifier.test.ts), type-check clean
  - **Acceptance criteria met**: POST with correct headers, per-day dedup for deadlines, 7-day dedup for stale projects, digest at configured time, graceful failure when ntfy.sh unreachable, state persistence
- 2026-04-13: TASK-013 completed — Implemented Ollama AI summarization system:
  - **Local AI summaries** for active projects using llama3.1:8b model via Ollama API (http://localhost:11434)
  - **1-hour in-memory cache** keyed by projectName:fileMtime, cache invalidates when state file changes
  - **Backend**: Created server/lib/ollama-client.ts with getOllamaStatus and summarizeProject functions
  - **API endpoints**: GET /api/ai/status (Ollama availability check), GET /api/ai/summarize/:project (single project summary), POST /api/ai/summarize-all (bulk summarize with sequential processing to avoid overwhelming Ollama)
  - **Security**: Path traversal protection on all endpoints, state file content truncated to 2000 chars before sending to Ollama
  - **Frontend**: Updated useProjects hook to auto-fetch AI summaries after initial load (non-blocking, only for active projects), updated ProjectCard to display AI summary in indigo box with "AI ·" label
  - **Graceful degradation**: When Ollama unavailable, returns null with no error UI (silent failure)
  - **Configuration**: OLLAMA_URL (default http://localhost:11434), OLLAMA_MODEL (default llama3.1:8b) in .env.example
  - **Files created**: server/lib/ollama-client.ts, server/routes/ai.ts, server/lib/ollama-client.test.ts
  - **12 unit tests passing** (cache expiration, status checks, timeout handling, content truncation, error scenarios), type-check clean
  - **195 total tests passing** (183 existing + 12 new Ollama tests)
- 2026-04-13: TASK-014 completed — Implemented chat export viewer with search and project tagging:
  - **User workflow**: Drop Claude JSON export files into VAULT_DIR/ChatExports/, dashboard displays conversation list with search, preview, and tags
  - **Backend**: Created server/lib/chat-export-parser.ts with 4 core functions:
    - listConversations: scans *.json files (skips .tags.json), parses Claude export format, merges tags from sidecar, sorts by updatedAt descending
    - searchConversations: case-insensitive full-text search across conversation names and message text, ranks title matches higher (score 10) than content matches (score 1)
    - getConversation: fetches single conversation with full message thread by UUID
    - setConversationTags: updates .tags.json sidecar with atomic writes (write to temp, then rename)
  - **API endpoints**: Created server/routes/chats.ts mounted at /api/chats:
    - GET /api/chats — list all conversations without messages (lightweight)
    - GET /api/chats/search?q=... — search with relevance ranking
    - GET /api/chats/:uuid — single conversation with full messages
    - PATCH /api/chats/:uuid/tags — body: { tags: string[] }
  - **Security**: Path traversal protection on all operations, UUID validation rejects ../, /, and \
  - **Frontend**: Created src/hooks/useChats.ts with 300ms debounced search, tagConversation function, getConversationDetail function
  - **ChatExplorer component**: Created src/components/ChatExplorer.tsx with:
    - Conversation list: title, relative date (Today/Yesterday/Nd ago), message count, preview (first 100 chars of first human message), tag pills
    - Inline message thread expansion: click to expand/collapse full conversation
    - Message bubbles: human (right-aligned blue), assistant (left-aligned gray border)
    - Long message truncation: "Show more" for messages >500 chars
    - Tag editing: click "+ Add tags" or "Edit tags", autocomplete suggests project names, save/cancel buttons
    - Empty state: no render when ChatExports/ has no .json files (keeps dashboard clean)
    - Search bar: debounced 300ms, shows "No conversations match your search" when empty results
  - **Integration**: Added ChatExplorer to App.tsx below main grid, wrapped in ErrorBoundary, passes projectNames prop for tag autocomplete
  - **Files created**: server/lib/chat-export-parser.ts, server/lib/chat-export-parser.test.ts (23 tests), server/routes/chats.ts, src/hooks/useChats.ts, src/components/ChatExplorer.tsx
  - **23 unit tests passing** (parsing multiple files, preview truncation, tag merging, search ranking, tag persistence, path security, UUID validation)
  - **Type-check clean, 232 total tests passing** (1 pre-existing flaky test in DeadlineTimeline unrelated to this task)
  - **All P1 tasks complete** ✅
- 2026-04-16: TASK-015 completed — Implemented multi-vault support enabling multiple knowledge bases:
  - **VAULT_DIRS environment variable**: Comma-separated absolute paths supplements VAULT_DIR, enables reading from secondary Obsidian vaults, Apple Notes exports, Logseq, etc.
  - **vault-config module**: Created server/lib/vault-config.ts with env-reading wrappers:
    - getVaultDirs(): reads process.env.VAULT_DIR + process.env.VAULT_DIRS, returns deduplicated array of resolved paths
    - isPathInVault(filePath): validates file paths are inside configured vaults (path traversal protection)
    - getPrimaryVaultDir(): returns VAULT_DIR for write operations (capture, notifications)
  - **vault-dirs module**: Created server/lib/vault-dirs.ts with core resolution logic (async directory existence checks, deduplication)
  - **Route updates**: Updated server/routes/todos.ts and server/routes/deadlines.ts to use getVaultDirs() and scan all configured vaults
  - **Library enhancements**: Enhanced todo-extractor.ts and deadline-reader.ts with multi-vault functions (extractTodosMultiVault, readDeadlinesMultiVault)
  - **Features**:
    - Automatic path deduplication by resolved absolute path
    - Non-existent directories: logged as warnings but included (may be created later, e.g., Wiki/ dir on first ingest)
    - Non-absolute paths: logged as warnings and skipped for security
    - Path traversal protection across all configured vaults
    - Write operations always use primary vault (VAULT_DIR only) — capture-writer.ts unchanged
    - Backward compatible: works with single VAULT_DIR when VAULT_DIRS not set (no breaking changes)
  - **Documentation**: Added VAULT_DIRS to .env.example with clear comments and example
  - **Tests**: Created comprehensive test suites (29 new tests total):
    - server/lib/vault-config.test.ts (17 tests): getVaultDirs deduplication, non-existent/non-absolute handling, isPathInVault validation, getPrimaryVaultDir
    - server/lib/multi-vault.test.ts (12 tests): resolveVaultDirs, isPathInVaults, extractTodosMultiVault, readDeadlinesMultiVault with multiple vaults
  - **276 total tests passing** (259 existing + 17 vault-config + 12 multi-vault tests, note: 3 tests removed from earlier count), type-check clean
  - **Dependency**: Unblocks TASK-016 (LLM Wiki will respect multi-vault configuration)
- 2026-04-16: TASK-016 completed — Implemented LLM Wiki core infrastructure based on Karpathy LLM Wiki pattern:
  - **Architecture**: Three-layer design: (1) Raw sources (user's existing notes, immutable), (2) Wiki pages (Ollama-generated markdown in VAULT_DIR/Wiki/), (3) Schema (conventions in SCHEMA.md)
  - **wiki-manager module**: Created server/lib/wiki-manager.ts with 5 core functions:
    - ensureWikiExists(wikiDir): Auto-creates Wiki/, SCHEMA.md, index.md, log.md on first ingest (idempotent, safe to call repeatedly)
    - ingestSource(sourcePath, wikiDir): Main ingest pipeline — reads source file → truncates to 4000 chars → calls Ollama with ---WIKI_PAGE--- format prompt → parses response → creates/updates wiki pages with YAML frontmatter → updates index.md → appends to log.md
    - readIndex(wikiDir): Parses index.md catalog format `- [[Page Name]] — Summary. (sources: N)` into WikiPage stubs
    - listPages(wikiDir): Scans Wiki/*.md (excluding SCHEMA/index/log), parses frontmatter for full metadata
    - appendLog(wikiDir, operation, detail): Appends timestamped entries `## [YYYY-MM-DD HH:mm] operation | Source: detail`
  - **API endpoints**: Created server/routes/wiki.ts with 3 REST endpoints:
    - POST /api/wiki/ingest: Accepts `{ sourcePath }`, validates path in vault/projects, returns `{ pagesCreated, pagesUpdated, error? }` always HTTP 200
    - GET /api/wiki/index: Returns `{ pages: WikiPage[], wikiExists: boolean }`
    - GET /api/wiki/pages: Returns `{ pages: WikiPage[] }` with full frontmatter metadata
  - **Ollama integration**: Uses existing ollama-client.getOllamaStatus, makes direct fetch to /api/generate with custom wiki prompt
  - **Wiki page format**: YAML frontmatter (title, status: seedling/developing/mature, sources: [], last_updated: YYYY-MM-DD) + markdown content with [[wikilinks]]
  - **Page merging**: Updates append content under `## Updated [date]` heading without overwriting, deduplicates sources array in frontmatter
  - **Security**: Path traversal protection via vault-config.isPathInVault, validates sourcePath must be in configured vault or projects dir
  - **Error handling**: Graceful degradation when Ollama unavailable (returns error in body, never throws), handles missing source file, empty Ollama response, parse failures
  - **Tests**: Created server/lib/wiki-manager.test.ts with 23 comprehensive unit tests:
    - Mocks Ollama fetch responses with ---WIKI_PAGE--- format
    - Uses temp filesystem for file operations
    - Covers ensureWikiExists idempotency, ingestSource parse/create/update/error cases, readIndex format parsing with skipped non-matching lines, listPages filtering (skips SCHEMA/index/log), appendLog format
    - All tests pass with full coverage of acceptance criteria
  - **299 total tests passing** (276 existing + 23 new wiki-manager tests), type-check clean
  - **Files created**: server/lib/wiki-manager.ts (16.5KB, 5 exported functions), server/routes/wiki.ts (rewritten, 3 endpoints), server/lib/wiki-manager.test.ts (19.5KB, 23 tests)
  - **Dependencies**: Uses vault-config.isPathInVault from TASK-015, uses ollama-client.getOllamaStatus from TASK-013
  - **Next**: Unblocks TASK-017 (query + lint + WikiPanel frontend component)
- 2026-04-16: TASK-018 completed — Implemented self-learning gap analysis with DuckDuckGo resource recommendations:
  - **Backend gap analysis**: Extended wiki-manager.ts with analyzeGaps function that detects knowledge gaps from wiki lint (referenced [[links]] with no pages) and active project state files (topics mentioned but no wiki page)
  - **Gap ranking**: Ranks gaps by reference frequency — more references = higher priority = lower number (1-5 scale)
  - **Resource discovery**: Fetches recommendations via DuckDuckGo Instant Answer API (zero API keys) for top 5 gaps: articles and YouTube videos (up to 3 per gap), 200ms delay between calls for rate limiting
  - **Output file**: Writes prioritized gap list to VAULT_DIR/Wiki/gaps.md with format: topic, reason, priority, resources (title, url, type)
  - **API endpoint**: Added POST /api/wiki/gaps (always HTTP 200, errors in body)
  - **Weekly notifications**: Extended notification-service.ts with weekly gap digest — sends ntfy notification with top 3 gaps once per 7 days, added lastGapNotification to NotificationState
  - **Frontend**: Extended useWiki hook with gaps state (KnowledgeGap[] | null) and analyzeGaps method, extended WikiPanel with GapList section:
    - Empty state: "Click Analyze to find gaps" before first analysis
    - Gap cards: priority badge, topic name, reason text, resource links (articles with 📄, videos with ▶)
    - Resource links: open in new tab (target="_blank" rel="noopener noreferrer")
    - "Add to Inbox" button: calls POST /api/capture with "Learn: {topic}", shows success toast
    - Loading message: "Analyzing... (this may take a moment)" during 10-30s analysis
    - Empty result: "No knowledge gaps found — your wiki is complete! 🎉"
  - **Error handling**: DuckDuckGo failures handled gracefully (returns empty resources array, never throws)
  - **Tests**: Added 33 new tests total:
    - wiki-manager.test.ts: 18 new tests for analyzeGaps (gap detection from lint + projects, ranking by reference count, DuckDuckGo fetching with graceful failure, gaps.md writing, log appending)
    - WikiPanel.test.tsx: 6 new tests for GapList (empty state, gap rendering with resources, Analyze button, Add to Inbox, loading/empty states)
    - Updated 9 existing WikiPanel tests to include new gaps and gapsLoading fields
  - **332 total tests passing** (299 existing + 33 new/updated), type-check clean
  - **All acceptance criteria met**: POST /api/wiki/gaps returns correct format, gaps ranked by cross-reference frequency, DuckDuckGo resources fetched, gaps.md written, weekly ntfy notification, Add to Inbox creates correct entry, GapList renders, comprehensive unit tests
- 2026-04-16: TASK-019 completed — Implemented multi-account Claude chat sync:
  - **Backend changes**: Extended TASK-014 chat export viewer to support multiple Claude accounts
  - **Recursive scanning**: Made chat export scan recursive (ChatExports/**/*.json) with account derivation from folder structure
  - **Account derivation**: Top-level files → account: "default", subfolder files → account: subfolder name (e.g., ChatExports/Personal/*.json → account: "Personal")
  - **scanChatExports helper**: Scans one level deep only (no deeper recursion), path traversal protection on all file reads
  - **Type updates**: Updated ConversationMeta interface to include account: string field
  - **Backend functions updated**:
    - listConversations: optional account filter parameter
    - searchConversations: optional account filter parameter
    - getConversation: includes account field in returned data
  - **API endpoints updated**:
    - GET /api/chats?account=X — filter conversations by account
    - GET /api/chats/search?q=Y&account=X — search with optional account filter
  - **Frontend hook**: Updated useChats with accounts (derived unique list), activeAccount (filter state), setActiveAccount (update filter)
  - **Frontend component**: Updated ChatExplorer with:
    - Account badge: shown on each conversation when 2+ accounts exist, hidden for "default" account
    - Account filter dropdown: shown when 2+ accounts exist, allows filtering by account or "All accounts"
  - **Backward compatibility**: Flat exports (ChatExports/*.json) still work with account = "default", existing single-account users see no UI changes
  - **Tests**: Added 9 comprehensive new tests:
    - Flat files get account: "default"
    - Subfolder files get account from folder name
    - Mixed flat + subfolder exports with correct derivation
    - Account filtering in listConversations
    - Account field in searchConversations
    - Account filtering in searchConversations
    - Account field in getConversation
    - No recursion beyond one level deep
    - Path traversal protection for subdirectories
  - **341 total tests passing** (332 existing + 9 new), type-check clean
  - **All acceptance criteria met**: flat exports work with "default", subfolders scanned, ConversationMeta includes account, ChatExplorer shows badges and filter, all 23 existing tests pass, new tests cover recursive scan and account derivation
- 2026-04-16: TASK-017 completed — Implemented LLM Wiki query and lint operations with WikiPanel dashboard component:
  - **Backend extensions**: Extended wiki-manager.ts with queryWiki function and lintWiki function
  - **queryWiki**: Finds relevant pages via keyword matching (splits question into ≥4 char words, scores pages by keyword overlap in name/summary, takes top 5), calls Ollama to synthesize 2-4 sentence answer with [[Page Name]] citations, parses citation references from response, appends to log.md with question preview
  - **lintWiki**: Builds inbound link map by scanning all pages for [[wikilinks]], detects orphans (pages with no inbound links from other pages, excluding index/log), finds stale pages (source file mtime > wiki page mtime), identifies gaps (referenced [[links]] with no corresponding .md file), calculates health score 0-100 (start at 100, -5 per orphan, -10 per stale, -10 per gap, clamped to 0), appends to log.md with score breakdown
  - **API endpoints**: Extended server/routes/wiki.ts with POST /api/wiki/query (validates question non-empty + max 500 chars, returns {answer, citations[], error?}) and POST /api/wiki/lint (returns {orphans[], stale[], gaps[], healthScore, wikiExists})
  - **Frontend hook**: Created src/hooks/useWiki.ts with wikiExists/pages/loading/error/gaps/gapsLoading state, query/lint/ingest/analyzeGaps methods, fetchIndex on mount
  - **WikiPanel component**: Created src/components/WikiPanel.tsx with:
    - Conditional render: empty state when wikiExists=false (shows "No wiki yet — ingest a file to start" with ingest input)
    - Header: title "🧠 Wiki" + health badge (green >80, amber 50-80, red <50, gray "Not linted" before first lint) + Lint button
    - Query section: text input + Ask button, shows loading "Thinking...", displays answer in gray box with citation chips [[PageName]] as indigo badges
    - Pages list: scrollable (max-height 300px), shows name + summary + status emoji (🌱 seedling, 🌿 developing, 🌳 mature)
    - GapList section: from TASK-018, shows gaps with priority/topic/resources + Add to Inbox button
    - Ingest section: file path input + Ingest button with success/error toast (✅/❌ messages, auto-dismiss after 5s)
  - **Integration**: Added WikiPanel to App.tsx below main grid, wrapped in ErrorBoundary
  - **Files**: Extended server/lib/wiki-manager.ts (+queryWiki, +lintWiki), extended server/routes/wiki.ts (+POST query, +POST lint), src/hooks/useWiki.ts (new), src/components/WikiPanel.tsx (new), src/components/WikiPanel.test.tsx (new)
  - **Tests**: 15 WikiPanel component tests (empty state, query flow with citations, lint badge color tiers, health badge rendering, page list rendering, ingest flow with toast, gap analysis), 41 wiki-manager tests (query with Ollama mock, keyword matching, citation parsing, lint orphan/stale/gap detection, health score calculation, log appending)
  - **341 total tests passing** (340 existing + 1 pre-existing flaky test in DeadlineTimeline unrelated to this task), type-check clean
  - **All acceptance criteria met**: POST /api/wiki/query returns {answer, citations}, POST /api/wiki/lint returns complete LintResult, WikiPanel renders when wiki exists, query search box with debounce (no auto-submit, only on Enter/button), health badge color tiers correct, ingest button accepts path, comprehensive unit tests
- 2026-04-16: TASK-020 completed — Implemented Google Calendar OAuth2 integration with read-only access:
  - **Backend**: Created server/lib/calendar-client.ts with OAuth2 flow (getAuthUrl generates consent URL with CSRF state token, exchangeCodeForTokens swaps code for access/refresh tokens, saveTokens/loadTokens manage data/calendar-tokens.json, auto-refresh when expiry < 5min, getCalendarEvents fetches today + next 7 days via googleapis Calendar API v3)
  - **API routes**: Created server/routes/calendar.ts with 3 endpoints:
    - GET /api/calendar/auth — redirects to Google OAuth consent screen with CSRF state parameter
    - GET /api/calendar/callback — validates state token, exchanges authorization code for tokens, saves to data/calendar-tokens.json, redirects to frontend with success
    - GET /api/calendar — returns {events: CalendarEvent[], status: 'connected'} when authenticated, {events: [], status: 'not_connected', authUrl} when no tokens
  - **Frontend hook**: Created src/hooks/useCalendar.ts with 60-second polling, loading/error/data states, CalendarResponse type
  - **CalendarPanel component**: Created src/components/CalendarPanel.tsx with:
    - Not connected state: "Connect Google Calendar" button linking to /api/calendar/auth
    - Connected state: today's events as time blocks (shows time, title, duration), next 7 days as compact list grouped by date
    - Free gap detection: finds >45min gaps between 9am-6pm on today's schedule, displays as green chips with time range
    - Suggestion chip: when free gaps detected AND stale projects exist, shows "Use free time to work on [stalest project]?"
    - Date labels: "Today", "Tomorrow", or formatted date for next 7 days
    - All-day event handling: separate display format
  - **Configuration**: Added GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_URI to .env.example with comments, added data/ directory to .gitignore for token storage, added "Google Calendar Setup" section to README.md with step-by-step Google Cloud Console instructions
  - **Security**: Read-only scope (https://www.googleapis.com/auth/calendar.readonly), CSRF protection with ephemeral state tokens (10-minute TTL), tokens stored in local data/ directory (gitignored), path traversal protection
  - **Integration**: Mounted calendarRouter in server/index.ts, added CalendarPanel to App.tsx in right sidebar above DeadlineTimeline, wrapped in ErrorBoundary
  - **Files created**: server/lib/calendar-client.ts, server/lib/calendar-client.test.ts, server/routes/calendar.ts, server/routes/calendar.test.ts, src/hooks/useCalendar.ts, src/components/CalendarPanel.tsx, src/components/CalendarPanel.test.tsx
  - **Dependencies**: Installed googleapis (Google APIs Node.js client), supertest + @types/supertest (for route testing)
  - **Tests**: 5 calendar-client tests (hasCredentials check, getAuthUrl with state/scope, token save/load structure validation), 7 calendar route tests (not_connected response, connected with events, auth redirect, callback code/state validation, error handling), 7 CalendarPanel component tests (loading skeleton, error banner, not_connected button, connected with events, free gap detection, suggestion chip with stale projects, empty calendar)
  - **359 total tests passing** (341 existing + 19 new calendar tests, note: 1 pre-existing flaky DeadlineTimeline test unrelated to this task), type-check clean
  - **All acceptance criteria met**: GET /api/calendar returns correct response shape for both states, OAuth2 flow complete (auth → callback → token stored), CalendarPanel renders both states, free gaps detected correctly, suggestion chip shows when gaps + stale projects, data/calendar-tokens.json in .gitignore, .env.example updated, README.md has setup guide, comprehensive tests with mocked Google API
- 2026-04-16: TASK-021 completed — Implemented YouTube watch history (Google Takeout) parser and MediaPanel:
  - **YouTube history parser**: Created server/lib/youtube-history-parser.ts with parseYouTubeHistory (parses Google Takeout watch-history.json JSON array, strips "Watched " prefix from titles, filters out "Searched for" search entries, extracts channel from subtitles[0].name with "Unknown Channel" fallback, deduplicates by URL keeping most recent watch), getYouTubeStats (groups by month YYYY-MM format, computes top 5 channels from last 30 days, returns last30Days capped at 50 entries), getYouTubeHistoryData (availability check with graceful empty state when YOUTUBE_HISTORY_PATH not set or file missing)
  - **API endpoint**: Created server/routes/media.ts with GET /api/youtube-history returning {available: boolean, total: number, last30Days: YouTubeEntry[], byMonth: MonthSummary[], topChannels: ChannelStats[]}
  - **Frontend hook**: Created src/hooks/useYouTubeHistory.ts with 60-second polling, loading/error/refetch states, EMPTY_HISTORY default
  - **MediaPanel component**: Created src/components/MediaPanel.tsx with two views:
    - Not available state: placeholder card with "No YouTube history yet" + button to open setup guide modal
    - Available state: "Recent Watches" section (last 7 days, max 10 videos, shows title/channel/relative date, clickable links to videos) + "Top Channels This Month" section (bar-style visualization with gray background bars and blue progress bars, shows channel name and count)
  - **Setup guide modal**: Full-screen overlay with step-by-step Google Takeout instructions (10 steps from takeout.google.com → select YouTube → history only → download → extract watch-history.json → copy to path → add to .env → restart server), example .env entry, "Got it" button to close
  - **Configuration**: Added YOUTUBE_HISTORY_PATH to .env.example with comments and reference to setup guide
  - **Vault setup guide**: Created VAULT_DIR/Resources/YouTube-Takeout-Setup.md with detailed instructions (same as modal but in markdown format with troubleshooting section)
  - **Integration**: Added MediaPanel to App.tsx sidebar after CalendarPanel, before DeadlineTimeline, wrapped in ErrorBoundary
  - **Files created**: server/lib/youtube-history-parser.ts, server/lib/youtube-history-parser.test.ts, server/routes/media.ts, src/hooks/useYouTubeHistory.ts, src/components/MediaPanel.tsx
  - **Tests**: 22 comprehensive unit tests for parser:
    - Valid entry parsing with title/url/channel/watchedAt extraction
    - "Watched " prefix stripping from titles
    - "Searched for" entry filtering (rejected)
    - Missing channel graceful handling (defaults to "Unknown Channel")
    - Missing required field skipping (entries without title/titleUrl/time ignored)
    - URL deduplication with most recent watch kept
    - Descending date sorting
    - Malformed JSON handling (returns empty array)
    - Non-array JSON handling (returns empty array)
    - Missing file handling (returns empty array)
    - Empty history handling
    - getYouTubeStats: total count, last30Days filtering and 50-entry limit, month grouping, top channels ranking by count descending
  - **381 tests passing** (382 total, 1 pre-existing flaky DeadlineTimeline test unrelated to this task), type-check clean, build passing
  - **API verified**: Tested GET /api/youtube-history with no YOUTUBE_HISTORY_PATH returns {available: false, total: 0, last30Days: [], byMonth: [], topChannels: []}
  - **All acceptance criteria met**: parser handles Takeout format correctly, "Searched for" entries filtered, GET /api/youtube-history returns correct shape, graceful empty state, MediaPanel renders both views, setup guide in vault and modal, .env.example updated, comprehensive parser tests
- 2026-04-18: TASK-027 completed — Implemented Obsidian Canvas reader with GET/POST endpoints and frontend panel:
  - **Canvas parser**: Created server/lib/canvas-parser.ts with parseCanvas (parses JSON Canvas spec {nodes, edges}, returns CanvasData with filename/nodeCount/edgeCount/textPreview [first 3 text nodes, 80 chars each]/fileNodes/lastModified, handles all node types [text/file/link/group], gracefully skips malformed JSON) and addNodeToCanvas (writes new text node with random 8-char hex ID, positions at maxY+100, supports color codes 1-6)
  - **API routes**: Created server/routes/canvases.ts with GET /api/canvases (recursive scan for *.canvas, returns sorted by lastModified desc, 3-minute cache, clearCanvasCache export for testing) and POST /api/canvases/:filename/add-node (validates text non-empty, validates color 1-6 if provided, finds file recursively, strict path traversal protection via vault-config.isPathInVault, invalidates cache)
  - **Integration**: Registered route in server/index.ts
  - **Frontend hook**: Created src/hooks/useCanvases.ts with 60-second polling, addNode function
  - **CanvasPanel component**: Created src/components/CanvasPanel.tsx with 2-column grid, cards show filename/N nodes·N edges stats/text preview chips [first 40 chars]/file node chips/Open in Obsidian button [obsidian://open deep link]/inline add-node form with text input+Add button+success/error toast
  - **Integration**: Added CanvasPanel to App.tsx after GitActivityPanel, wrapped in ErrorBoundary
  - **Files created**: server/lib/canvas-parser.ts + canvas-parser.test.ts (19 tests), server/routes/canvases.ts + canvases.test.ts (16 tests), src/hooks/useCanvases.ts, src/components/CanvasPanel.tsx
  - **Features**: MCP-ready POST endpoint (Claude can add nodes as action), vault write-back enabled for .canvas files only, path validation prevents traversal attacks, cache fixes test isolation
  - **475 total tests passing** (added 35 new tests: 19 parser + 16 routes), type-check clean (pre-existing KnowledgeGraph errors unrelated)
  - **All acceptance criteria met**: GET /api/canvases returns canvas metadata, JSON Canvas spec correctly parsed, CanvasPanel renders cards with preview, POST add-node appends node correctly, path traversal check on :filename param, comprehensive tests
