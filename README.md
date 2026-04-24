# Cortex

Cortex is a local-first personal command center that turns a projects folder and an Obsidian vault into a single dashboard. It scans project state files, aggregates TODOs and deadlines, surfaces notes and reading material, and layers optional local AI features on top through Ollama.

The app runs as:

- A web dashboard powered by React + Vite
- An Express API that reads and writes local files
- An optional Electron desktop shell
- An optional MCP server for Claude Desktop style tool access

## What It Does

- Scans `PROJECTS_DIR` for project state files and builds a project overview
- Extracts TODOs from markdown across projects and vaults
- Reads and writes deadlines from `Deadlines/deadlines.md`
- Supports quick capture into `Inbox/inbox.md`
- Shows reading items, git activity, review queue items, canvases, wiki pages, and chat exports
- Supports optional local AI summaries and RAG chat through Ollama
- Opens notes in Obsidian and projects in VS Code

## Stack

- React 18
- Vite
- TypeScript
- Tailwind CSS
- Express
- Electron
- Vitest
- Ollama for local AI features

## Requirements

- Node.js 20+
- npm
- Ollama installed locally if you want AI summaries or chat
- An Obsidian vault and a projects directory

## Setup

1. Install dependencies:

```bash
npm install
```

2. Copy `.env.example` to `.env` and set at least:

```env
PROJECTS_DIR=C:\path\to\_Projects
VAULT_DIR=C:\path\to\SecondBrain
VAULT_NAME=SecondBrain
```

3. If you want AI features, make sure Ollama is running and the configured model exists:

```bash
ollama pull llama3.1:8b
```

## Running

Start the full dev stack:

```bash
npm run dev
```

This starts:

- Vite on `http://localhost:5173`
- Express on `http://localhost:3001`
- Ollama bootstrap logic via `scripts/start-ollama.cjs`

Useful commands:

```bash
npm test
npm run type-check
npm run build
```

## Electron

Run the desktop app in development:

```bash
npm run electron:dev
```

Compile Electron entrypoints:

```bash
npm run electron:compile
```

Build desktop packages:

```bash
npm run electron:build
```

## MCP Server

Start the MCP server:

```bash
npm run mcp:dev
```

Build the MCP server output:

```bash
npm run mcp:build
```

See [mcp-config.example.json](./mcp-config.example.json) for a sample Claude Desktop style configuration.

## Environment Notes

Core variables:

- `PROJECTS_DIR`: root directory containing your projects
- `VAULT_DIR`: primary Obsidian vault
- `VAULT_NAME`: vault name used for `obsidian://` links
- `VAULT_DIRS`: optional extra vault roots, comma-separated
- `PORT`: backend port, default `3001`

Optional integrations:

- `OLLAMA_URL`, `OLLAMA_MODEL`
- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI`
- `NTFY_TOPIC`, `NTFY_DIGEST_TIME`, `NTFY_URL`
- `YOUTUBE_HISTORY_PATH`
- `CHROME_BOOKMARKS_PATH`

## Project Layout

```text
src/         frontend app
server/      Express routes and file-parsing logic
electron/    Electron main and preload code
scripts/     local utility scripts
data/        local runtime data
build/       desktop build assets
```

## Local-Only Model

Cortex is designed around local files and localhost services. Most value comes from your own project directories, vault content, and locally running Ollama rather than hosted backends.

## Notes

- The app expects project state to come from files like `.agents/state.md`, `.agents/state.json`, `agent_state.md`, `state.md`, `Status.md`, or `README.md`
- Deadline writes target `Deadlines/deadlines.md`
- Obsidian links depend on `VAULT_NAME` matching the vault name shown inside Obsidian
