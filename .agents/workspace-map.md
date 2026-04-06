# Workspace Map

> Updated by agents whenever files are created, moved, or deleted.
> Agents read this to orient themselves instead of scanning the entire codebase.

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
├── src/                             # React frontend
│   ├── App.tsx                      # Main app component
│   ├── main.tsx                     # React entry point
│   ├── index.css                    # Tailwind imports
│   └── components/                  # [planned] UI components
│       ├── ProjectCard.tsx
│       ├── DeadlineTimeline.tsx
│       ├── TodoAggregator.tsx
│       ├── QuickCapture.tsx
│       └── StatusOverview.tsx
└── server/                          # Express.js backend
    ├── index.ts                     # Express server entry with all API routes mounted
    ├── routes/
    │   ├── projects.ts              # ✓ GET /api/projects (TASK-003)
    │   ├── todos.ts                 # ✓ GET /api/todos, PATCH /api/todos/:id (TASK-004)
    │   ├── deadlines.ts             # ✓ GET /api/deadlines (TASK-005)
    │   ├── capture.ts               # ✓ POST /api/capture, GET /api/capture/corpus (TASK-006)
    │   └── ai.ts                    # [planned] POST /api/ai/summarize (P1)
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
        └── markdown-parser.ts       # [planned] Markdown parsing utilities
```

## External Paths (not in repo)

```
C:\Users\boomb\Documents\_Projects\          ← Existing projects directory (scanned, never modified)
C:\Users\boomb\Documents\SecondBrain\        ← [planned] Obsidian vault
├── .obsidian/
├── Inbox/
│   └── inbox.md                             ← Quick capture destination
├── Projects/                                ← Symlinks to _Projects/* subfolders
├── Areas/
├── Resources/
├── Archive/
├── ChatExports/
├── Deadlines/
│   └── deadlines.md                         ← Manual deadline entries
└── DailyNotes/
C:\Users\boomb\Documents\notes_corpus.txt.txt  ← Existing notes file to parse
```
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
- `server/index.ts` — Express app with /api/projects, /api/todos, /api/deadlines, and /api/capture routes
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

**Config**:
- `package.json` — npm scripts (dev, build, test, type-check)
- `tsconfig.json` — TypeScript compiler settings
- `vite.config.ts` — Vite dev server with /api proxy
- `tailwind.config.js` — Tailwind CSS setup

**Frontend (Minimal)**:
- `src/App.tsx` — Placeholder app component
- `src/main.tsx` — React entry point
