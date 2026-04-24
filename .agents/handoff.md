# Handoff: Automated State Diffing (weekly git-summary per project)
**Task ID**: TASK-043
**Mode**: autonomous (no user interaction available)

## Context

**Project**: Cortex — local-only personal command center dashboard. React+Vite+TypeScript frontend on :5173, Express.js TypeScript backend on :3001. Repo at `C:\Users\boomb\Documents\_Projects\Brain2`.

**What exists**: Git activity parser in `server/lib/git-activity-parser.ts` (scans all `.git` dirs in PROJECTS_DIR). Ollama client in `server/lib/ollama-client.ts` with `generateSummary()`. Notification service in `server/lib/notification-service.ts` with scheduled jobs (ntfy digest, weekly review trigger). Weekly review route in `server/routes/weekly.ts`.

## Task

### 1. Create `server/lib/git-summary-generator.ts`

```typescript
export async function generateProjectGitSummary(projectPath: string, projectName: string): Promise<string | null>
```

- Run `git log --since=7.days --stat` in the project directory using `child_process.execSync` or `simple-git`
- If no commits in last 7 days, return null
- Feed the git log output to Ollama with prompt:
  ```
  Summarize this week's development activity in 3-4 sentences.
  What was worked on? What changed? Be factual, only use the git log below.
  
  Git log for project "{projectName}":
  {gitLogOutput}
  ```
- Write the result to `{projectPath}/.cortex-weekly-summary.md` with a date header
- Return the summary text
- Graceful no-op: if Ollama unavailable, log warning and return null

### 2. Add POST /api/projects/:slug/auto-summary route

In `server/routes/projects.ts` (or a new file):
- Resolve slug to project directory (with path traversal protection — validate against PROJECTS_DIR)
- Call `generateProjectGitSummary()`
- Return `{ summary, savedTo }` or `{ error }` if failed

### 3. Add weekly trigger to notification-service.ts

Add a check alongside the existing weekly review trigger:
- On Friday at 5PM (configurable via `WEEKLY_SUMMARY_DAY` env var default "5" for Friday, `WEEKLY_SUMMARY_HOUR` env var default "17")
- Iterate all projects in PROJECTS_DIR, call `generateProjectGitSummary()` for each
- Log results to console

### 4. Show weekly summary in ProjectDetailView

In `src/pages/ProjectDetailView.tsx`:
- Fetch `.cortex-weekly-summary.md` content via an endpoint or include it in the project detail API response
- If the file exists, display as a collapsible "📊 This Week" section
- Use a simple `<details>` / `<summary>` HTML element for the collapse

### 5. Run tests and commit

- `npm test -- --reporter=dot`
- `npx tsc --noEmit`
- `git add -A && git commit -m "feat(TASK-043): automated weekly git-summary per project"`

## Acceptance Criteria
- [ ] POST /api/projects/:slug/auto-summary generates Ollama summary from git diffs
- [ ] Summary written to PROJECTS_DIR/{project}/.cortex-weekly-summary.md
- [ ] Weekly auto-trigger in notification-service.ts (Friday 5PM, configurable)
- [ ] ProjectDetailView displays weekly summary when file exists
- [ ] Graceful no-op when Ollama unavailable or no git history
- [ ] Never overwrites state files (only writes .cortex-weekly-summary.md)
- [ ] Path traversal protection on :slug parameter
- [ ] Tests for git diff parsing and summary prompt construction

## Validation Gates
- [ ] `npm test -- --reporter=dot` passes
- [ ] `npx tsc --noEmit` no new errors
- [ ] `git commit` done

## Files to Read First
- `server/lib/git-activity-parser.ts` — existing git parsing
- `server/lib/ollama-client.ts` — Ollama integration
- `server/lib/notification-service.ts` — scheduled job pattern
- `server/routes/projects.ts` — existing project routes
- `src/pages/ProjectDetailView.tsx` — where to display summary

## Constraints
- Do NOT overwrite any existing state files (Status.md, state.md, etc.)
- Only write to `.cortex-weekly-summary.md`
- Path traversal protection is MANDATORY on the :slug parameter
- Do NOT ask questions — make reasonable assumptions and document them
