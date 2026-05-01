# Cortex

A local-only personal command center that aggregates your projects, deadlines, TODOs, and knowledge into a single web dashboard. It reads markdown project state files from a projects directory, pulls data from an Obsidian vault, and surfaces everything in one place. Optional local AI features run through Ollama — no hosted backends, no auth, no accounts.

**Runs entirely on localhost. Single user. No deployment.**

---

## What It Does

- **Project Scanner** — scans `PROJECTS_DIR` for state files (`agent_state.md`, `state.json`, `state.md`, `Status.md`, `README.md`), extracts status, last-modified date, and next steps; shows stale project warnings at 14 and 30 days
- **TODO Aggregator** — scans all markdown across projects and vault for `- [ ]`, `TODO:`, `FIXME:`, `HACK:` patterns; groups by project; supports in-place checkbox toggling from the UI
- **Deadline Timeline** — reads `Deadlines/deadlines.md`, color-codes by urgency (red < 48 h, amber < 7 days, green), merges with Google Calendar events
- **Quick Capture** — one keystroke to append a timestamped note to `Inbox/inbox.md`
- **Kanban Board** — drag-and-drop task board backed by markdown
- **Focus Mode** — distraction-free single-task view
- **Velocity Tracker** — TODO completion rate over time with charts
- **Knowledge / Wiki** — browse, search, and link vault notes; wiki-link graph via D3
- **Chat Exports** — import and search Claude / Gemini conversation exports
- **Canvas Viewer** — renders Obsidian `.canvas` files
- **Reading List** — aggregates Chrome bookmarks and vault reading log
- **Git Activity** — per-project commit history from local repos
- **Daily / Weekly Notes** — auto-generated daily notes template; weekly review generation
- **Media** — YouTube watch history viewer
- **Review Queue** — spaced-repetition style review log for vault notes
- **AI Chat (RAG)** — ask questions answered from your vault using Ollama + embedding index
- **AI Summaries** — "where did I leave off?" per-project summaries via Ollama or Claude API
- **MCP Server** — exposes all data as tools for Claude Desktop / MCP clients

---

## Stack

| Layer | Choice |
|-------|--------|
| Frontend | React 18 + Vite + TypeScript |
| Styling | Tailwind CSS |
| Backend | Express.js (TypeScript) |
| Desktop | Electron (optional) |
| Charts | Recharts + D3 |
| Local AI | Ollama (llama3.1:8b default) |
| Calendar | Google Calendar API (OAuth2) |
| MCP | `@modelcontextprotocol/sdk` |
| Tests | Vitest |
| Package manager | npm |

---

## Requirements

- Node.js 20+
- npm
- Ollama (optional — only needed for AI features)
- An Obsidian vault and a projects directory on the local filesystem

---

## Setup

1. Install dependencies:

```bash
npm install
```

2. Copy `.env.example` to `.env` and configure at minimum:

```env
PROJECTS_DIR=C:\path\to\_Projects
VAULT_DIR=C:\path\to\SecondBrain
VAULT_NAME=SecondBrain
```

3. If you want AI summaries or RAG chat, pull a model:

```bash
ollama pull llama3.1:8b
```

---

## Running

Start the full dev stack (Vite + Express + Ollama bootstrap):

```bash
npm run dev
```

- Frontend: `http://localhost:5173`
- Backend API: `http://localhost:3001`

Other commands:

```bash
npm test             # run Vitest suite
npm run type-check   # TypeScript check, no emit
npm run build        # production build
```

---

## Electron Desktop App

Run in development:

```bash
npm run electron:dev
```

Compile Electron entrypoints only:

```bash
npm run electron:compile
```

Build distributable packages:

```bash
npm run electron:build
```

---

## MCP Server

Start the MCP server (for Claude Desktop integration):

```bash
npm run mcp:dev
```

See [mcp-config.example.json](./mcp-config.example.json) for a sample configuration.

---

## Environment Variables

### Required

| Variable | Description |
|----------|-------------|
| `PROJECTS_DIR` | Root directory containing your projects |
| `VAULT_DIR` | Primary Obsidian vault path |
| `VAULT_NAME` | Vault name used to build `obsidian://` deep links |

### Optional

| Variable | Description |
|----------|-------------|
| `VAULT_DIRS` | Extra vault roots, comma-separated |
| `PORT` | Backend port (default `3001`) |
| `OLLAMA_URL` | Ollama base URL (default `http://localhost:11434`) |
| `OLLAMA_MODEL` | Model name (default `llama3.1:8b`) |
| `GOOGLE_CLIENT_ID` | Google OAuth2 client ID for Calendar sync |
| `GOOGLE_CLIENT_SECRET` | Google OAuth2 client secret |
| `GOOGLE_REDIRECT_URI` | OAuth2 redirect URI |
| `NTFY_TOPIC` | ntfy.sh topic for push notifications |
| `NTFY_DIGEST_TIME` | Daily digest send time |
| `NTFY_URL` | ntfy.sh server URL |
| `YOUTUBE_HISTORY_PATH` | Path to YouTube watch history JSON |
| `CHROME_BOOKMARKS_PATH` | Path to Chrome `Bookmarks` file |

---

## Project Layout

```text
src/             React frontend (components, pages, hooks, contexts)
server/
  routes/        Express route handlers (one file per domain)
  lib/           File parsers, scanners, and business logic
electron/        Electron main and preload entrypoints
scripts/         Local utility scripts (dev runner, bundler, etc.)
data/            Runtime data (calendar tokens, import cache)
build/           Desktop build assets
.dev/prd/        Product requirements documents
```

---

## File Conventions

### State File Detection (priority order)

The project scanner looks for these files in each project folder:

1. `agent_state.md`
2. `Agent_State.json`
3. `state.md`
4. `Status.md`
5. `README.md`

### Deadline Format

```markdown
- [ ] YYYY-MM-DD | Description | optional-tag
- [x] YYYY-MM-DD | Description | optional-tag
```

### Quick Capture Format

```markdown
- [ ] [YYYY-MM-DD HH:mm] Captured text
```

---

## Write-back Policy

The app is read-only by default. Explicit write operations are limited to:

- `Inbox/inbox.md` — append only (quick capture)
- `Resources/ReadingLog.md` — append only
- `Resources/review-log.json` — mark-reviewed updates
- `DailyNotes/YYYY-WXX-weekly-review.md` — weekly review generation
- `**/*.canvas` — add-node only
- TODO checkbox toggling in any project file (`[ ]` → `[x]` in-place)
- `Deadlines/deadlines.md` — append new deadline or remove by ID
- `data/calendar-tokens.json` — OAuth2 token storage (gitignored)

---

## Local-Only Design

All value comes from your own files. No data leaves your machine unless you explicitly enable the Claude API (`ANTHROPIC_API_KEY`) or Google Calendar OAuth2. Ollama runs fully offline.
