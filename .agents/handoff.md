# Handoff: Extend MCP Server with 3 new tools
**Task ID**: TASK-047
**Mode**: autonomous (no user interaction available)

## Context

**Project**: Cortex — local-only personal command center dashboard. React+Vite+TypeScript frontend on :5173, Express.js TypeScript backend on :3001. Repo at `C:\Users\boomb\Documents\_Projects\Brain2`.

**What exists**: MCP server in `server/mcp-server.ts` with tool registration. MCP tools in `server/lib/mcp-tools.ts` with 8 existing tools (list_todos, get_deadlines, add_capture, search_wiki, etc.). Each tool uses Zod for input validation. Wiki manager in `server/lib/wiki-manager.ts` with `lintWiki()`. Weekly review logic in `server/routes/weekly.ts`. Project detail logic in `server/routes/projects.ts`.

## Task

### 1. Add `run_wiki_lint` tool to `server/lib/mcp-tools.ts`

```typescript
// Input: none (or optional { verbose: boolean })
// Output: { healthScore: number, orphans: string[], stale: string[], gaps: string[] }
```

- Wraps `lintWiki()` from wiki-manager.ts
- Returns the health score and arrays of orphaned concepts, stale entries, and knowledge gaps
- Error handling: return `{ error: string }` on failure, not throw

### 2. Add `generate_weekly_review` tool

```typescript
// Input: none (or optional { weekOffset: number })
// Output: { summary: string, savedTo: string }
```

- Reuses the weekly review generation logic from `server/routes/weekly.ts`
- Triggers a review generation and returns the generated text + file path
- Error handling: return `{ error: string }` if Ollama unavailable

### 3. Add `get_project_detail` tool

```typescript
// Input: { projectName: string }  (accepts slug or display name)
// Output: { name: string, slug: string, status: string, stateContent: string, todos: Todo[], aiSummary: string | null }
```

- Reuses logic from the project detail route (GET /api/projects/:slug)
- Returns project state file content, scoped TODOs, and AI summary if available
- Error handling: return `{ error: string }` if project not found

### 4. Register all 3 in `server/mcp-server.ts`

Follow the existing pattern for tool registration. Each tool needs:
- Zod schema for inputs
- Handler function that calls the tool implementation
- Return typed JSON

### 5. Update `mcp-config.example.json`

Update the tool count comment or add the new tool names to the config example.

### 6. Run tests and commit

- `npm test -- --reporter=dot`
- `npx tsc --noEmit`
- `git add -A && git commit -m "feat(TASK-047): extend MCP server with 3 new tools"`

## Acceptance Criteria
- [ ] run_wiki_lint tool registered and returns {healthScore, orphans, stale, gaps}
- [ ] generate_weekly_review tool registered and returns {summary, savedTo}
- [ ] get_project_detail tool registered and returns {name, status, stateContent, todos, aiSummary}
- [ ] All 3 tools have Zod input schemas
- [ ] All tools return typed JSON with error handling (return {error} not throw)
- [ ] mcp-config.example.json updated
- [ ] Tests for all 3 new tool handlers

## Validation Gates
- [ ] `npm test -- --reporter=dot` passes
- [ ] `npx tsc --noEmit` no new errors
- [ ] `git commit` done

## Files to Read First
- `server/lib/mcp-tools.ts` — existing tool implementations (pattern to follow)
- `server/mcp-server.ts` — tool registration pattern
- `server/lib/wiki-manager.ts` — lintWiki function
- `server/routes/weekly.ts` — weekly review generation logic
- `server/routes/projects.ts` — project detail logic
- `mcp-config.example.json` — config to update

## Constraints
- Follow the EXACT pattern used by existing MCP tools for registration and error handling
- All tools must return `{ error: string }` on failure, never throw
- Do NOT ask questions — make reasonable assumptions and document them
