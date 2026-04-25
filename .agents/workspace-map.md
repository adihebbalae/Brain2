# Workspace Map

> Recent addition: `scripts/dev-runner.cjs` replaces the concurrently-based launcher for local dev and reuses running services instead of spawning duplicate frontend/backend/Ollama processes.

> Updated by agents whenever files are created, moved, or deleted.
> Agents read this to orient themselves instead of scanning the entire codebase.

## Recent Additions

- `server/lib/wiki-imports.test.ts` â€” normalization regression coverage for Claude structured-message exports and Calendar ICS imports

- `server/lib/wiki-import-queue.ts` â€” persisted single-worker background queue for wiki import scan/normalize/ingest jobs
- `server/lib/wiki-import-parsers.test.ts` â€” parser coverage for Chrome bookmark HTML and YouTube Takeout HTML
- `server/routes/wiki-imports.test.ts` â€” route coverage for `/api/wiki/imports*` and `/api/wiki/import-jobs/:jobId`
- `src/hooks/useWikiImports.ts` â€” frontend polling hook for import datasets and background jobs
- `src/components/ImportsPanel.tsx` â€” Knowledge page Imports tab UI for scan, normalize, and wiki ingest
- `src/components/ImportsPanel.test.tsx` â€” UI coverage for imports dataset cards and job progress

## Project Structure

```
Brain2/                              ← THIS REPO = Cortex dashboard
├── .agents/
│   ├── state.json                   # Machine-readable project state (source of truth)
│   ├── state.md                     # Human-readable project dashboard
│   ├── workspace-map.md             # THIS FILE — directory reference
│   ├── handoff.md                   # Current inter-agent handoff prompt
│   └── MODULES.md                   # Module registry (scanner, todos, deadlines, capture, frontend)
├── .dev/
│   └── prd/
│       └── original.md              # Staged PRD (reference only — brief in state.json is canonical)
├── .github/
│   ├── copilot-instructions.md      # Project-specific coding standards
│   ├── agents/                      # Agent definitions (manager, engineer, security, etc.)
│   ├── prompts/                     # Prompt shortcuts (/init-project, /handoff-to-*, etc.)
│   └── skills/                      # Skill definitions (tdd, code-review, quality-gate, etc.)
├── .vscode/
│   └── mcp.json                     # MCP server config (Context7)
├── PRD.md                           # Original PRD (reference)
├── .env                             # Environment variables (not in git)
├── .env.example                     # Environment variables template
├── package.json                     # Single package — React+Vite+Express+concurrently
├── package-lock.json                # npm lock file
├── tsconfig.json                    # TypeScript config
├── tsconfig.node.json               # TypeScript config for Vite
├── vite.config.ts                   # Vite config with proxy to backend
├── vitest.config.ts                 # Vitest testing config
├── tailwind.config.js               # Tailwind CSS config
├── postcss.config.js                # PostCSS config for Tailwind
├── index.html                       # HTML entry point
├── src/                             # React frontend + Chrome extension
│   ├── extension/                   # ✓ Chrome extension (TASK-029)
│   │   ├── manifest.json            # ✓ Manifest V3 config (TASK-029)
│   │   ├── popup.html               # ✓ Extension popup UI (TASK-029)
│   │   ├── popup.js                 # ✓ Extension logic (TASK-029)
│   │   ├── README.md                # ✓ Install instructions (TASK-029)
│   │   └── icons/
│   │       ├── icon16.svg           # ✓ 16px icon (TASK-029)
│   │       ├── icon48.svg           # ✓ 48px icon (TASK-029)
│   │       └── icon128.svg          # ✓ 128px icon (TASK-029)
│   ├── App.tsx                      # ✓ Main dashboard layout (TASK-007)
│   ├── App.test.tsx                 # ✓ App component tests (TASK-007)
│   ├── main.tsx                     # React entry point
│   ├── index.css                    # ✓ Tailwind imports + CSS animations (TASK-008)
│   ├── types.ts                     # ✓ Shared TypeScript interfaces: Project, Todo, Deadline (TASK-007, TASK-008, TASK-009)
│   ├── hooks/
│   │   ├── useProjects.ts           # ✓ Data fetching hook for projects (TASK-007)
│   │   ├── useProjects.test.ts      # ✓ Shared-store dedupe tests for the projects hook
│   │   ├── useTodos.ts              # ✓ Data fetching hook for todos with optimistic updates (TASK-008)
│   │   ├── useTodos.test.ts         # ✓ useTodos hook tests (TASK-008)
│   │   ├── useDeadlines.ts          # ✓ Data fetching hook for deadlines (TASK-009)
│   │   ├── useDeadlines.test.ts     # ✓ useDeadlines hook tests (TASK-009)
│   │   ├── useChats.ts              # ✓ Data fetching hook for chat exports with debounced search (TASK-014)
│   │   ├── useWiki.ts               # ✓ Data fetching hook for wiki with query/lint/ingest/analyzeGaps (TASK-017)
│   │   ├── useCalendar.ts           # ✓ Data fetching hook for Google Calendar with 60s polling (TASK-020)
│   │   ├── useYouTubeHistory.ts     # ✓ Data fetching hook for YouTube history with 60s polling (TASK-021)
│   │   ├── useReading.ts            # ✓ Data fetching hook for reading list with 60s polling (TASK-022)
│   │   ├── useCanvases.ts           # ✓ Data fetching hook for canvases with 60s polling, addNode function (TASK-027)
│   │   ├── useReviewQueue.ts        # ✓ Data fetching hook for review queue with 60s polling, markReviewed, getRandomNote (TASK-028)
│   │   └── useConfig.ts             # ✓ Data fetching hook for config (vaultName, projectsDir) from /api/config (TASK-038)
│   └── components/
│       ├── ProjectCard.tsx          # ✓ Project card component (TASK-007)
│       ├── ProjectCard.test.tsx     # ✓ ProjectCard tests (TASK-007)
│       ├── StatusOverview.tsx       # ✓ Stats overview panel (TASK-007)
│       ├── TodoAggregator.tsx       # ✓ TODO aggregator with grouping and optimistic updates (TASK-008)
│       ├── TodoAggregator.test.tsx  # ✓ TodoAggregator tests (TASK-008)
│       ├── DeadlineTimeline.tsx     # ✓ Deadline timeline with urgency indicators (TASK-009)
│       ├── DeadlineTimeline.test.tsx # ✓ DeadlineTimeline tests (TASK-009)
│       ├── QuickCapture.tsx         # ✓ Quick capture input bar component (TASK-010)
│       ├── QuickCapture.test.tsx    # ✓ QuickCapture tests (TASK-010)
│       ├── CommandPalette.tsx       # ✓ Command palette with cmdk: Ctrl+K fuzzy search for navigation, projects, actions (TASK-042)
│       ├── CommandPalette.css       # ✓ Command palette dark theme styles (TASK-042)
│       ├── ErrorBoundary.tsx        # ✓ React error boundary for graceful error handling (TASK-011)
│       ├── ChatExplorer.tsx         # ✓ Chat export viewer with inline message expansion and tagging (TASK-014)
│       ├── WikiPanel.tsx            # ✓ Wiki panel with query/lint/ingest/gaps UI (TASK-017)
│       ├── WikiPanel.test.tsx       # ✓ WikiPanel component tests (TASK-017)
│       ├── CalendarPanel.tsx        # ✓ Google Calendar panel with OAuth, events, free gaps, suggestions (TASK-020)
│       ├── CalendarPanel.test.tsx   # ✓ CalendarPanel component tests (TASK-020)
│       ├── MediaPanel.tsx           # ✓ YouTube watch history panel with setup guide modal (TASK-021)
│       ├── ReadingPanel.tsx         # ✓ Reading list panel with bookmarks + vault merge, quick add, topic chips (TASK-022)
│       ├── DailyPanel.tsx           # ✓ Daily context panel with today's date, calendar, deadlines, stale projects, random notes, git activity (TASK-025)
│       ├── CanvasPanel.tsx          # ✓ Obsidian Canvas panel with grid cards, Open in Obsidian, add-node form (TASK-027)
│       ├── ReviewPanel.tsx          # ✓ Review queue panel with progress ring, mark/skip buttons, Surprise Me modal (TASK-028)
│       ├── VelocityPanel.tsx        # ✓ Velocity tracking panel with Recharts bar chart, trend arrows, 30-day snapshot view (TASK-044)
│       └── BrainChat.tsx            # ✓ Full-panel RAG chat overlay with SSE streaming, source chips, session history (TASK-023)
└── server/                          # Express.js backend
    ├── index.ts                     # ✓ Express server entry with all API routes + notification service (TASK-012)
    ├── integration.test.ts          # ✓ End-to-end integration tests (26 tests, TASK-011)
    ├── mcp-server.ts                # ✓ Standalone MCP server for Claude Desktop (TASK-030)
    ├── routes/
    │   ├── projects.ts              # ✓ GET /api/projects, POST /api/projects/:slug/auto-summary, GET /api/projects/:slug/weekly-summary (TASK-003, TASK-043)
    │   ├── todos.ts                 # ✓ GET /api/todos, PATCH /api/todos/:id (TASK-004)
    │   ├── deadlines.ts             # ✓ GET /api/deadlines with riskScore field (TASK-005, TASK-044)
    │   ├── velocity.ts              # ✓ GET /api/velocity with snapshots and trend data (TASK-044)
    │   ├── capture.ts               # ✓ POST /api/capture, GET /api/capture/corpus (TASK-006)
    │   ├── config.ts                # ✓ GET /api/config (vaultName, projectsDir) (TASK-038)
    │   ├── ai.ts                    # ✓ GET /api/ai/status, GET /api/ai/summarize/:project, POST /api/ai/summarize-all (TASK-013)
    │   ├── chats.ts                 # ✓ GET /api/chats, GET /api/chats/search, GET /api/chats/:uuid, PATCH /api/chats/:uuid/tags (TASK-014)
    │   ├── wiki.ts                  # ✓ POST /api/wiki/ingest, GET /api/wiki/index, GET /api/wiki/pages, POST /api/wiki/query, POST /api/wiki/lint, POST /api/wiki/gaps, POST /api/wiki/ingest-projects (TASK-016, TASK-017, TASK-018, TASK-037)
    │   ├── wiki.test.ts             # ✓ 7 unit tests for wiki routes, including ingest-projects endpoint (TASK-037)
    │   ├── calendar.ts              # ✓ GET /api/calendar/auth, GET /api/calendar/callback, GET /api/calendar (TASK-020)
    │   ├── calendar.test.ts         # ✓ 7 unit tests for calendar routes (TASK-020)
    │   ├── media.ts                 # ✓ GET /api/youtube-history (TASK-021)
    │   ├── reading.ts               # ✓ GET /api/reading, POST /api/reading (TASK-022)
    │   ├── reading.test.ts          # ✓ 12 unit tests for reading routes (TASK-022)
    │   ├── canvases.ts              # ✓ GET /api/canvases, POST /api/canvases/:filename/add-node (TASK-027)
    │   ├── canvases.test.ts         # ✓ 16 unit tests for canvases routes (TASK-027)
    │   ├── review.ts                # ✓ GET /api/review/queue, POST /api/review-log, GET /api/review/queue/random (TASK-028)
    │   ├── review.test.ts           # ✓ 12 unit tests for review routes (TASK-028)
    │   ├── daily.ts                 # ✓ GET /api/daily-context (TASK-025)
    │   ├── daily.test.ts            # ✓ 8 unit tests for daily context route (TASK-025)
    │   ├── weekly.ts                # ✓ POST /api/weekly-review, GET /api/weekly-review/status, autoTriggerWeeklyReview (TASK-025)
    │   ├── weekly.test.ts           # ✓ 14 unit tests for weekly review routes (TASK-025)
    │   └── chat-query.ts            # ✓ POST /api/chat/query with RAG context assembly and SSE streaming (TASK-023)
    └── lib/
        ├── scanner.ts               # ✓ Project scanner (TASK-003)
        ├── scanner.test.ts          # ✓ 17 unit tests for scanner (TASK-003)
        ├── state-reader.ts          # ✓ State file reader with priority detection (TASK-003)
        ├── todo-extractor.ts        # ✓ TODO/FIXME/HACK extraction with write-back (TASK-004)
        ├── todo-extractor.test.ts   # ✓ 22 unit tests for TODO extractor (TASK-004)
        ├── deadline-reader.ts       # ✓ Parses deadlines.md with urgency calculation (TASK-005)
        ├── deadline-reader.test.ts  # ✓ 22 unit tests for deadline reader (TASK-005)
        ├── capture-writer.ts        # ✓ Appends timestamped entries to inbox.md (TASK-006)
        ├── capture-writer.test.ts   # ✓ 9 unit tests for capture writer (TASK-006)
        ├── notes-corpus-parser.ts   # ✓ Parses notes corpus file for TODOs/ideas/notes (TASK-006)
        ├── notes-corpus-parser.test.ts  # ✓ 15 unit tests for corpus parser (TASK-006)
        ├── notifier.ts              # ✓ Core notification sender using native fetch (TASK-012)
        ├── notifier.test.ts         # ✓ 15 unit tests for notifier (TASK-012)
        ├── notification-state.ts    # ✓ State persistence for notification deduplication (TASK-012)
        ├── notification-service.ts  # ✓ Background service for red deadlines, stale projects, daily digest, weekly git summaries (TASK-012, TASK-043)
        ├── ollama-client.ts         # ✓ Ollama API client with 1h cache (TASK-013)
        ├── ollama-client.test.ts    # ✓ 12 unit tests for Ollama client (TASK-013)
        ├── chat-export-parser.ts    # ✓ Parses Claude conversation exports with search and tagging (TASK-014)
        ├── chat-export-parser.test.ts  # ✓ 23 unit tests for chat export parser (TASK-014)
        ├── vault-config.ts          # ✓ Multi-vault configuration with env-reading wrappers (TASK-015)
        ├── vault-config.test.ts     # ✓ 17 unit tests for vault-config (TASK-015)
        ├── vault-dirs.ts            # ✓ Core vault directory resolution logic (TASK-015)
        ├── multi-vault.test.ts      # ✓ 12 unit tests for multi-vault todo/deadline extraction (TASK-015)
        ├── wiki-manager.ts          # ✓ LLM Wiki core: ensureWikiExists, ingestSource, readIndex, listPages, appendLog, queryWiki, lintWiki, analyzeGaps (TASK-016, TASK-017, TASK-018)
        ├── wiki-manager.test.ts     # ✓ 41 unit tests for wiki-manager (TASK-016, TASK-017, TASK-018)
        ├── calendar-client.ts       # ✓ Google Calendar OAuth2 client: getAuthUrl, exchangeCodeForTokens, saveTokens, loadTokens, getCalendarEvents, auto-refresh (TASK-020)
        ├── calendar-client.test.ts  # ✓ 5 unit tests for calendar-client (TASK-020)
        ├── youtube-history-parser.ts  # ✓ Google Takeout watch-history.json parser: parseYouTubeHistory, getYouTubeStats, getYouTubeHistoryData (TASK-021)
        ├── youtube-history-parser.test.ts  # ✓ 22 unit tests for YouTube history parser (TASK-021)
        ├── bookmarks-parser.ts      # ✓ Chrome Bookmarks file parser: parseChromebookmarks, getChromeBookmarksPath, recursive tree walk (TASK-022)
        ├── bookmarks-parser.test.ts # ✓ 9 unit tests for bookmarks parser (TASK-022)
        ├── reading-log-parser.ts    # ✓ ReadingLog.md parser: parseReadingLog, appendToReadingLog (TASK-022)
        ├── reading-log-parser.test.ts  # ✓ 12 unit tests for reading-log parser (TASK-022)
        ├── git-activity-parser.ts   # ✓ Git activity scanner: getGitActivity, runs git log across all projects, builds heatmap and per-project stats (TASK-026)
        ├── git-activity-cache.ts    # ✓ Shared in-memory git activity cache used by multiple routes
        ├── git-activity-parser.test.ts  # ✓ 9 unit tests for git activity parser (TASK-026)
        ├── git-summary-generator.ts # ✓ Weekly git summary generator: runs git log --since=7.days, generates Ollama summaries, writes to .cortex-weekly-summary.md (TASK-043)
        ├── git-summary-generator.test.ts  # ✓ 6 unit tests for git-summary-generator (TASK-043)
        ├── velocity-tracker.ts      # ✓ Daily velocity snapshots: records TODOs and commits, writes to .cortex-velocity.json, calculates weekly averages (TASK-044)
        ├── canvas-parser.ts         # ✓ JSON Canvas parser: parseCanvas, addNodeToCanvas with color support (TASK-027)
        ├── canvas-parser.test.ts    # ✓ 19 unit tests for canvas parser (TASK-027)
        ├── review-log.ts            # ✓ Review log manager: loadReviewLog, saveReviewLog, markReviewed, syncNewNotes (TASK-028)
        ├── review-log.test.ts       # ✓ 16 unit tests for review-log (TASK-028)
        ├── review-queue.ts          # ✓ Review queue logic: getReviewQueue, getRandomNote with priority sorting (TASK-028)
        ├── review-queue.test.ts     # ✓ 17 unit tests for review-queue (TASK-028)
        ├── rag-engine.ts            # ✓ RAG context assembly: keyword extraction, chunk scoring, context building from 5 sources (TASK-023)
        ├── rag-cache.ts             # ✓ Shared background-refresh cache for the RAG index
        ├── rag-engine.test.ts       # ✓ 21 unit tests for RAG engine (TASK-023)
        ├── mcp-tools.ts             # ✓ MCP tool handlers: registers 8 tools wrapping existing lib functions with Zod schemas (TASK-030)
        ├── mcp-tools.test.ts        # ✓ 24 unit tests for MCP tools (TASK-030)
        └── markdown-parser.ts       # [planned] Markdown parsing utilities
```

## External Paths (not in repo)

```
C:\Users\boomb\Documents\_Projects\          ← Existing projects directory (scanned, never modified)
C:\Users\boomb\Documents\SecondBrain\        ← [planned] Obsidian vault
├── .obsidian/
├── .cortex-notify-state.json                ← Notification state (last sent timestamps)
├── Inbox/
│   └── inbox.md                             ← Quick capture destination
├── Projects/                                ← Symlinks to _Projects/* subfolders
├── Areas/
├── Resources/
│   └── YouTube-Takeout-Setup.md             ← Setup guide for YouTube watch history (TASK-021)
├── Archive/
├── ChatExports/
├── Deadlines/
│   └── deadlines.md                         ← Manual deadline entries
├── DailyNotes/
└── Wiki/                                    ← LLM Wiki (Ollama-generated, TASK-016)
    ├── SCHEMA.md                            ← Wiki conventions (auto-created)
    ├── index.md                             ← Page catalog (auto-updated)
    ├── log.md                               ← Ingest history (append-only)
    └── *.md                                 ← Wiki pages with YAML frontmatter + [[wikilinks]]
C:\Users\boomb\Documents\notes_corpus.txt.txt  ← Existing notes file to parse
```
mcp-config.example.json          # ✓ Example Claude Desktop MCP configuration (TASK-030)
README.md                        # Boilerplate documentation
```

## Key Directories

- **server/** — Express.js TypeScript backend
  - **lib/** — Business logic (scanner, state-reader, extractors)
  - **routes/** — API endpoints
- **src/** — React TypeScript frontend
  - **components/** — Reusable UI components (to be built)

## Key Files

**Backend (Completed)**:
- `server/index.ts` — Express app with /api/projects, /api/todos, /api/deadlines, /api/capture, /api/ai routes + notification service
- `server/lib/scanner.ts` — Scans PROJECTS_DIR for state files, returns sorted array
- `server/lib/state-reader.ts` — Priority detection, status inference, summary/next-steps extraction
- `server/routes/projects.ts` — GET /api/projects endpoint
- `server/lib/scanner.test.ts` — 17 unit tests with temp filesystem
- `server/lib/todo-extractor.ts` — TODO extraction (5 patterns) with checkbox write-back
- `server/routes/todos.ts` — GET /api/todos and PATCH /api/todos/:id endpoints
- `server/lib/todo-extractor.test.ts` — 22 unit tests with temp filesystem
- `server/lib/deadline-reader.ts` — Deadline parser with urgency calculation (red/amber/green/gray)
- `server/routes/deadlines.ts` — GET /api/deadlines endpoint
- `server/lib/deadline-reader.test.ts` — 22 unit tests with temp filesystem
- `server/lib/capture-writer.ts` — Appends timestamped entries to inbox.md with sanitization
- `server/routes/capture.ts` — POST /api/capture and GET /api/capture/corpus endpoints
- `server/lib/capture-writer.test.ts` — 9 unit tests with temp filesystem
- `server/lib/notes-corpus-parser.ts` — Parses notes_corpus.txt.txt for TODOs/ideas/notes
- `server/lib/notes-corpus-parser.test.ts` — 15 unit tests with temp filesystem
- `server/lib/notifier.ts` — ntfy.sh notification sender using native fetch
- `server/lib/notifier.test.ts` — 15 unit tests for notification sender
- `server/lib/notification-state.ts` — State persistence for notification deduplication
- `server/lib/notification-service.ts` — Background service (red deadlines, stale projects, daily digest)
- `server/lib/ollama-client.ts` — Ollama API client with 1-hour cache for AI summaries
- `server/routes/ai.ts` — GET /api/ai/status, GET /api/ai/summarize/:project, POST /api/ai/summarize-all endpoints
- `server/lib/ollama-client.test.ts` — 12 unit tests for Ollama client
- `server/lib/chat-export-parser.ts` — Claude conversation export parser with search and tagging (TASK-014)
- `server/routes/chats.ts` — GET /api/chats, GET /api/chats/search, GET /api/chats/:uuid, PATCH /api/chats/:uuid/tags endpoints (TASK-014)
- `server/lib/chat-export-parser.test.ts` — 23 unit tests for chat export parser (TASK-014)
- `server/lib/wiki-manager.ts` — LLM Wiki core functions: ensureWikiExists, ingestSource, readIndex, listPages, appendLog (TASK-016)
- `server/routes/wiki.ts` — POST /api/wiki/ingest, GET /api/wiki/index, GET /api/wiki/pages endpoints (TASK-016)
- `server/lib/wiki-manager.test.ts` — 23 unit tests for wiki-manager (TASK-016)

**Config**:
- `package.json` — npm scripts (dev, build, test, type-check)
- `tsconfig.json` — TypeScript compiler settings
- `vite.config.ts` — Vite dev server with /api proxy
- `tailwind.config.js` — Tailwind CSS setup

**Frontend (TASK-007, TASK-008, TASK-009 Completed)**:
- `src/App.tsx` — ✓ Main dashboard layout with header, stats, project grid, sidebar placeholders (TASK-007)
- `src/App.test.tsx` — ✓ 5 tests: loading state, error state, empty state, renders StatusOverview (TASK-007)
- `src/main.tsx` — React entry point
- `src/index.css` — ✓ Tailwind imports + CSS fade-in animation for toast (TASK-008)
- `src/types.ts` — ✓ Shared TypeScript interfaces (Project, Todo, Deadline) (TASK-007, TASK-008, TASK-009)
- `src/hooks/useProjects.ts` — ✓ Custom hook for fetching projects from API (TASK-007)
- `src/hooks/useTodos.ts` — ✓ Custom hook for fetching todos with optimistic toggle and rollback (TASK-008)
- `src/hooks/useTodos.test.ts` — ✓ 8 tests: fetch, error handling, optimistic update, rollback, refetch (TASK-008)
- `src/hooks/useDeadlines.ts` — ✓ Custom hook for fetching deadlines from API (TASK-009)
- `src/hooks/useDeadlines.test.ts` — ✓ 5 tests: fetch, error handling, refetch (TASK-009)
- `src/hooks/useChats.ts` — ✓ Custom hook for fetching chat exports with 300ms debounced search (TASK-014)
- `src/components/ProjectCard.tsx` — ✓ Project card with status badge, summary, next steps, Open in VS Code button (TASK-007)
- `src/components/ProjectCard.test.tsx` — ✓ 9 tests: status badges, stale borders, next steps truncation (TASK-007)
- `src/components/StatusOverview.tsx` — ✓ Stats bar showing active/stale/archived counts, total TODOs (TASK-007)
- `src/components/TodoAggregator.tsx` — ✓ TODO aggregator with grouping (project/file), optimistic toggle, completed disclosure, badges (TASK-008)
- `src/components/TodoAggregator.test.tsx` — ✓ 13 tests: grouping, collapsing, completed disclosure, toggle, badges (TASK-008)
- `src/components/DeadlineTimeline.tsx` — ✓ Deadline timeline with vertical layout, color-coded urgency, relative dates, tags, compact mode (TASK-009)
- `src/components/DeadlineTimeline.test.tsx` — ✓ 12 tests: loading/error/empty states, urgency styling, relative labels, compact mode, completed section (TASK-009)
- `src/components/QuickCapture.tsx` — ✓ Quick capture input bar with POST /api/capture, success/error toasts, Ctrl+K shortcut, input sanitization (TASK-010)
- `src/components/QuickCapture.test.tsx` — ✓ 20 tests: input/button, submit, toasts, keyboard shortcut, whitespace handling, loading states (TASK-010)
- `src/components/ErrorBoundary.tsx` — ✓ React class-based error boundary for graceful component error handling (TASK-011)
- `src/components/ChatExplorer.tsx` — ✓ Chat export viewer with conversation list, inline message expansion, tag editing with project autocomplete (TASK-014)
- `server/integration.test.ts` — ✓ 26 E2E integration tests validating all PRD success criteria (TASK-011)
