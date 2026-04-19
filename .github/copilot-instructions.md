# Project Instructions — Cortex

## Project Overview
Cortex is a local-only personal command center dashboard. It aggregates projects, deadlines, TODOs, and knowledge into a single web UI running on localhost.

## Tech Stack
- **Frontend**: React + Vite + TypeScript, Tailwind CSS
- **Backend**: Express.js (TypeScript)
- **Package manager**: npm (NOT pnpm — state.json says pnpm but npm is actually used. Always run `npm install`, `npm test`, `npm run dev`.)
- **No database** — all data read from filesystem (markdown files)
- **AI**: Claude API (optional, for summarization)
- **Test framework**: Vitest (unit + integration)

## Key Paths (configured via .env)
- `PROJECTS_DIR` → `C:\Users\boomb\Documents\_Projects` (scanned, never modified except TODO toggles)
- `VAULT_DIR` → `C:\Users\boomb\Documents\SecondBrain` (Obsidian vault)
- Dashboard code lives in THIS repo (Brain2)

## Architecture
- Frontend on `:5173` (Vite dev server)
- Backend on `:3001` (Express)
- `concurrently` runs both via `npm run dev`
- Backend reads filesystem directly — no DB layer
- Frontend fetches from `http://localhost:3001/api/*`

## Code Conventions
- Use TypeScript strict mode for all files
- Use `import type` for type-only imports
- Prefer named exports over default exports
- Use Tailwind utility classes — no custom CSS files unless necessary
- Backend route handlers go in `server/routes/`, business logic in `server/lib/`
- Frontend components go in `src/components/`, one component per file
- Use `async/await` over `.then()` chains
- Validate all filesystem paths — never trust user input to construct paths (path traversal prevention)

## File Conventions
- State file detection priority: `agent_state.md` → `Agent_State.json` → `state.md` → `Status.md` → `README.md`
- Deadline format: `- [ ] YYYY-MM-DD | Description | optional-tag`
- Quick capture format: `- [ ] [YYYY-MM-DD HH:mm] Text`
- TODO patterns: `- [ ]`, `- [x]`, `TODO:`, `FIXME:`, `HACK:`

## Security Rules
- **No auth needed** — localhost only, single user
- **Path traversal**: All file reads MUST be scoped to PROJECTS_DIR or VAULT_DIR. Reject any path that escapes these roots.
- **File write-back**: Only allowed for TODO checkbox toggling (in-place) and inbox.md appending. No other file writes.
- **API keys**: Store in `.env`, never commit. `.env.example` has placeholders only.

## Testing
- Use Vitest for all tests
- Test files: `*.test.ts` co-located with source
- Mock filesystem for scanner/extractor tests
- Integration tests can use a temporary test directory

## Agent System Protocol

This project uses a multi-agent architecture. Every agent MUST follow this protocol.

### On Session Start
1. Read `.agents/state.json` to understand current project state, active task, and context
2. Read `.agents/workspace-map.md` if you need to locate files or understand project structure
3. Identify your role and act within your boundaries
4. Do NOT proceed on a handoff if `handoff.approved_by_user` is `false` — wait for user approval

### On Session End
1. Update `.agents/state.json` with:
   - What you accomplished (add to `changelog`)
   - Current task status
   - Any blockers or decisions made
   - Updated `last_updated` and `last_updated_by`
2. Update `.agents/state.md` with a human-readable summary of changes
3. If you created or moved files, update `.agents/workspace-map.md`

### Handoff Protocol
When work needs to transfer between agents:

**Autonomous mode (v2.0, VS Code Feb 2026+)**: Manager uses `runSubagent` to spawn worker agents directly. No manual handoff needed after PRD approval. Manager controls the full loop until completion or a break condition is hit (3 Engineer failures or CRITICAL security finding).

**Manual mode (backward compatible)**: The sending agent writes the handoff prompt to `.agents/handoff.md`, updates `state.json` → `handoff` field, and shows a prominent banner to the user:
   ```
   ╔══════════════════════════════════════════════════════════════╗
   ║  🔀 SWITCH TO:  @[agent]   |   MODEL:  [Model]             ║
   ╚══════════════════════════════════════════════════════════════╝
   ```
   Then tells the user to run `/handoff-to-[agent]` or copy `.agents/handoff.md` to the target agent.

### State Files — Do Not Proliferate
- `.agents/state.json` — Machine state (single source of truth)
- `.agents/state.md` — Human-readable dashboard
- `.agents/workspace-map.md` — File/directory reference
- `.agents/handoff.md` — Current handoff prompt
- `.agents/MODULES.md` — Module registry for complex projects (3+ modules); auto-created by `/init-project`
- **No other state/summary files.** If it's not in these five files, it doesn't exist.

## Code Standards
- Write clean, readable code with meaningful names
- Handle errors at system boundaries (user input, API calls, external data)
- Never commit secrets, API keys, or credentials
- Run tests before declaring work complete
- Run the `quality-gate` skill before every push (lint → type-check → tests → security scan). Do not push with any stage failing.

## PowerShell Script Rules
- **No Unicode/fancy characters in string literals**: Do NOT use em dashes (—), curly quotes, or any non-ASCII character directly in `.ps1` string literals. They cause encoding parse errors at runtime. Use plain ASCII hyphens (`-`) instead of em dashes, straight quotes only.
- **No `[char]0xXXXX` for decorative output that appears inside computed strings**: Using `$([char]0x2014)` inside a double-quoted string is fine, but writing the literal Unicode character is not.
- **Keep banner/status strings ASCII-safe**: `Write-Banner`, `Write-Host`, and `blocked_on` string assignments must all use ASCII only.
- **Verify encoding after edits**: If a `.ps1` file is edited by a tool that may inject Unicode, run `[System.Management.Automation.Language.Parser]::ParseFile(...)` to confirm no parse errors before running.

## auto-run.ps1 Task Status Rules
- **Usage/rate limit failures**: If Claude CLI exits with a usage limit error, set task status back to `pending` (not `blocked`). `blocked` is reserved for genuine code/logic failures. Re-running the script resumes from the pending task automatically.
- **`context.blocked_on` hygiene**: Always clear `blocked_on` to `null` after a blocker is resolved. Stale blocker messages from previous runs must not persist into new sessions.
- **`security_between_tasks` flag**: The `auto_run.security_between_tasks` boolean in state.json controls whether security scans run after each task (not just at end). This is implemented in `.github/scripts/auto-run.ps1` via `$SecurityBetweenTasks`.
- **`current_task` cleanup after interruption**: If auto-run is interrupted (Ctrl+C, rate limit) mid-task, `current_task` and the task's `status` field are left as `in_progress`. Before re-running, manually reset: set `current_task` to `null` and the task's `status` back to `pending`.
- **`auto_run.task_order` contains all tasks, not just pending**: The array is the full historical order. The script filters by `status: pending/not_started` — so already-done tasks in the order are silently skipped. Don't remove completed tasks from `task_order`.

## Agent Status Verification Rules
- **Never trust `in_progress` without verifying code exists**: Before reporting a task as `in_progress` or `done`, verify the key files actually exist. Check for the component file, the route file, and any test file. If they're missing, the task is `pending`.
- **Verify file paths in handoffs before writing**: Before writing a handoff that references source files (e.g. "Read `server/lib/foo.ts`"), search the workspace to confirm those files exist. Wrong filenames cause Claude CLI to start from scratch instead of building on existing code.
- **Quick state audit command**: Run `$s = Get-Content .agents/state.json -Raw | ConvertFrom-Json; $s.tasks.PSObject.Properties | Select-Object Name, @{n='status';e={$_.Value.status}}` to get a clean status table before any auto-run.

## Allowed File Write-back Operations
Beyond the default read-only policy, these explicit write operations are permitted:
- `VAULT_DIR/Resources/inbox.md` — append only (quick capture)
- `VAULT_DIR/Resources/ReadingLog.md` — append only (reading tracker POST)
- `VAULT_DIR/Resources/review-log.json` — mark-reviewed updates only
- `VAULT_DIR/DailyNotes/YYYY-WXX-weekly-review.md` — weekly review generation
- `VAULT_DIR/**/*.canvas` — add-node only (Canvas MCP write-back)
- TODO checkbox toggling in any project file (in-place `[ ]` → `[x]` flip only)
- `data/calendar-tokens.json` — OAuth2 token storage (project root, gitignored)

## Communication Principles
- **Always include WHY**: When making a decision, choosing a priority, or recommending an approach, explain the reasoning. "Do X because Y" not just "Do X."
- **Research first**: Before making changes, search the codebase for existing patterns and conventions. Understand what exists before creating something new.
- **Close the loop**: If tests fail, fix them and re-run. If a build breaks, fix it. Don't report back with broken state — iterate until green.
- **Keep workspace organized**: Update `.agents/workspace-map.md` when files are created or moved. An organized workspace saves tokens and prevents drift.
