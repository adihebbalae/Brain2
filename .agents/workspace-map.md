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
├── .env.example                     # [planned] Environment variables template
├── package.json                     # [planned] Single package — React+Vite+Express+concurrently
├── tsconfig.json                    # [planned] TypeScript config
├── vite.config.ts                   # [planned] Vite config
├── tailwind.config.ts               # [planned] Tailwind config
├── src/                             # [planned] React frontend
│   ├── App.tsx
│   ├── main.tsx
│   └── components/
│       ├── ProjectCard.tsx
│       ├── DeadlineTimeline.tsx
│       ├── TodoAggregator.tsx
│       ├── QuickCapture.tsx
│       └── StatusOverview.tsx
└── server/                          # [planned] Express.js backend
    ├── index.ts                     # Express server entry
    ├── routes/
    │   ├── projects.ts              # GET /api/projects
    │   ├── todos.ts                 # GET /api/todos, PATCH /api/todos/:id
    │   ├── deadlines.ts             # GET /api/deadlines
    │   ├── capture.ts               # POST /api/capture
    │   └── ai.ts                    # POST /api/ai/summarize (P1)
    └── lib/
        ├── scanner.ts               # Project scanner — reads state files
        ├── todo-extractor.ts        # TODO/FIXME/HACK extraction from markdown
        ├── deadline-reader.ts       # Parses deadlines.md
        ├── markdown-parser.ts       # Markdown parsing utilities
        └── state-reader.ts          # State file reader (priority detection, status inference)
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
_To be populated when the project is scaffolded by the Manager._

## Key Files
_To be populated as the project grows._
