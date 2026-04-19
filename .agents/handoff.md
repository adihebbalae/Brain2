╔══════════════════════════════════════════════════════════════╗
║  🔀 SWITCH TO:  @engineer   |   MODEL:  Sonnet             ║
╚══════════════════════════════════════════════════════════════╝

# Handoff: TASK-030 — Cortex MCP Server
**From**: Manager → **To**: Engineer | **Model**: Sonnet
**Date**: 2026-04-19 | **Task ID**: TASK-030

## Context

Cortex is a local-only personal command center dashboard (Brain2 repo). It has:
- Express.js backend on `:3001` with ~20 routes reading filesystem data
- React frontend on `:5173`
- All existing lib functions in `server/lib/` (scanner, deadline-reader, todo-extractor, capture-writer, wiki-core, reading-log-parser, rag-engine, etc.)
- Tests via Vitest — currently 563 passing

The goal of this task is to expose the same backend data as an **MCP (Model Context Protocol) server** so Claude Desktop can query Cortex data directly via natural language. This is the highest-leverage next feature: Claude gains live access to the user's second brain without hallucinating.

**MCP reference**: https://modelcontextprotocol.io/
**SDK**: `@modelcontextprotocol/sdk` (npm package)
**Transport**: Use **stdio** transport for Claude Desktop compatibility (simplest, no HTTP).

## Task

Create `server/mcp-server.ts` — a standalone MCP server that registers 8 tools wrapping existing lib functions. The server runs as a separate process (not integrated into the Express server) and communicates via stdio.

### 8 Tools to Register

| Tool name | Wraps | Returns |
|-----------|-------|---------|
| `list_todos` | `extractTodos()` from `server/lib/todo-extractor.ts` | Array of `{text, file, line, done, priority}` |
| `get_deadlines` | `readDeadlinesMultiVault()` from `server/lib/deadline-reader.ts` | Array of `{date, description, tag, done, urgency}` |
| `list_projects` | `scanProjects()` from `server/lib/scanner.ts` | Array of `{name, status, staleDays, summary, nextSteps}` |
| `search_notes` | keyword search across vault `.md` files | Array of `{title, path, preview, score}` |
| `add_capture` | `writeCapture()` from `server/lib/capture-writer.ts` | `{success: true, text}` |
| `get_daily_context` | assemble deadline + stale projects + git summary | `{date, deadlines[], staleProjects[], gitActivity}` |
| `search_wiki` | `queryWiki()` from `server/lib/wiki-query.ts` | Array of `{term, definition, tags, file}` |
| `get_reading_log` | `parseReadingLog()` from `server/lib/reading-log-parser.ts` | Array of `{title, author, status, rating, dateRead}` |

### Input Schemas

- `list_todos`: optional `{ filter: "open" | "done" | "all" }` — default `"open"`
- `get_deadlines`: optional `{ days: number }` — upcoming N days, default 7
- `list_projects`: optional `{ status: "active" | "stale" | "all" }` — default `"all"`
- `search_notes`: required `{ query: string }`, optional `{ limit: number }` — default limit 10
- `add_capture`: required `{ text: string }`
- `get_daily_context`: no inputs
- `search_wiki`: required `{ query: string }`, optional `{ limit: number }` — default 5
- `get_reading_log`: optional `{ status: "read" | "reading" | "want-to-read" | "all" }` — default `"all"`

## File Structure

```
server/
  mcp-server.ts          ← NEW: standalone MCP server entry point
  lib/
    mcp-tools.ts         ← NEW: tool handler implementations (wraps existing libs)
    mcp-tools.test.ts    ← NEW: tests for all 8 tools
```

## Key Implementation Details

1. **Entry point** (`server/mcp-server.ts`):
```typescript
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { registerTools } from './lib/mcp-tools.js'

const server = new McpServer({ name: 'cortex', version: '1.0.0' })
registerTools(server)
const transport = new StdioServerTransport()
await server.connect(transport)
```

2. **Load env vars** at startup: `dotenv.config()` so `PROJECTS_DIR`, `VAULT_DIR` etc. are available.

3. **Error handling**: All tools should catch errors and return `{ error: string }` rather than throwing — MCP clients show tool errors to the user.

4. **search_notes implementation**: Simple keyword match — split query into words, scan vault .md files, score by word frequency. Reuse the RAG pattern from `server/lib/rag-engine.ts` if it has a scoring function; otherwise implement a simple 20-line variant.

5. **package.json scripts** — add:
```json
"mcp:build": "tsc --project tsconfig.node.json --outDir dist-mcp server/mcp-server.ts",
"mcp:dev": "npx tsx server/mcp-server.ts"
```

6. **Claude Desktop config** — create `mcp-config.example.json` at the repo root:
```json
{
  "mcpServers": {
    "cortex": {
      "command": "node",
      "args": ["C:/path/to/Brain2/dist-mcp/mcp-server.js"],
      "env": {
        "PROJECTS_DIR": "C:/Users/boomb/Documents/_Projects",
        "VAULT_DIR": "C:/Users/boomb/Documents/SecondBrain"
      }
    }
  }
}
```
Also document `npx tsx server/mcp-server.ts` as the dev variant.

## Acceptance Criteria

- [ ] `server/mcp-server.ts` exists and compiles with `npx tsc --noEmit`
- [ ] `server/lib/mcp-tools.ts` registers all 8 tools with correct input schemas
- [ ] `server/lib/mcp-tools.test.ts` has tests for all 8 tools (mocked filesystem / mocked lib calls)
- [ ] `npm test` still passes (563+ tests, now with new mcp-tools tests)
- [ ] `package.json` has `mcp:dev` script
- [ ] `mcp-config.example.json` exists at repo root with correct structure
- [ ] `@modelcontextprotocol/sdk` added to `package.json` dependencies

## Validation Gates

- [ ] `npx tsc --noEmit` — zero errors
- [ ] `npm test` — all tests pass (563 + new MCP tests)
- [ ] `npx tsx server/mcp-server.ts` starts without crashing (Ctrl+C to stop)
- [ ] Commit: `feat(TASK-030): Cortex MCP server — expose backend as Claude Desktop tools`

## Files to Read First

- `server/lib/todo-extractor.ts` — understand exported function signatures
- `server/lib/deadline-reader.ts` — `readDeadlinesMultiVault` signature
- `server/lib/scanner.ts` — `scanProjects` signature
- `server/lib/capture-writer.ts` — `writeCapture` signature
- `server/lib/wiki-query.ts` — `queryWiki` signature
- `server/lib/reading-log-parser.ts` — `parseReadingLog` signature
- `server/lib/rag-engine.ts` — borrow keyword scoring for `search_notes`
- `package.json` — understand current scripts and deps structure

## Constraints

- Do NOT integrate MCP into the existing Express server (`:3001`) — it must be standalone stdio
- Do NOT add authentication — this is localhost only, single user
- Do NOT use HTTP transport (SSE) — use stdio only for Claude Desktop compatibility
- Do NOT change any existing lib functions — only wrap them
- Do NOT add streaming to tools — return complete results as JSON
- Install `@modelcontextprotocol/sdk` only — no other new production deps
