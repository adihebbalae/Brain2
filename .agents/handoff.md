# Handoff: Wiki — Scan Projects button to bulk-ingest project README/state files
**Task ID**: TASK-037
**Mode**: autonomous (no user interaction available)

## Context

**Project**: Cortex — local-only personal command center dashboard. React+Vite+TypeScript frontend on :5173, Express.js TypeScript backend on :3001. Repo at `C:\Users\boomb\Documents\_Projects\Brain2`.

**The problem**: The Wiki panel (WikiPanel.tsx) currently requires users to manually type a full file path to ingest notes. There's no way to bulk-ingest from projects. New users have no onboarding path.

**Existing wiki infrastructure** (already built in TASK-016):
- `server/lib/wiki-manager.ts` — exports `ingestSource(sourcePath, wikiDir)` function
- `server/routes/wiki.ts` — has `POST /api/wiki/ingest` accepting `{ sourcePath }`
- `src/components/WikiPanel.tsx` — wiki UI component
- `src/hooks/useWiki.ts` — wiki hook
- `VAULT_DIR/Wiki/` — where wiki pages are written

**State file priority** (same as scanner):
```
agent_state.md → Agent_State.json → state.md → Status.md → README.md
```

**Key paths from .env**:
- `PROJECTS_DIR` = `C:\Users\boomb\Documents\_Projects`
- `VAULT_DIR` = `C:\Users\boomb\Documents\SecondBrain`

## Task

### 1. Add backend endpoint (server/routes/wiki.ts)

Add `POST /api/wiki/ingest-projects`:

```typescript
router.post('/ingest-projects', async (_req, res) => {
  // 1. Read PROJECTS_DIR from env
  // 2. Scan immediate subdirs (same as scanner.ts does)
  // 3. For each project dir, find first existing state file using priority order
  // 4. Call ingestSource(stateFilePath, wikiDir) for each found file
  // 5. Return { ingested: number, errors: string[] }
  // Always return HTTP 200 (errors in body)
})
```

The state file priority array (copy from `server/lib/state-reader.ts`):
```
['agent_state.md', 'Agent_State.json', 'state.md', 'Status.md', 'README.md']
```

Path traversal protection: all state file paths must be inside PROJECTS_DIR. Use `path.resolve()` and check that the resolved path starts with the resolved PROJECTS_DIR.

Ollama check: call `getOllamaStatus()` first. If Ollama unavailable, return `{ ingested: 0, errors: ['Ollama not available — start it first'] }`.

### 2. Update frontend hook (src/hooks/useWiki.ts)

Add `ingestProjects` function that calls `POST /api/wiki/ingest-projects` and returns `{ ingested: number, errors: string[] }`.

### 3. Update WikiPanel component (src/components/WikiPanel.tsx)

Add a "Scan Projects" button in the ingest section. Show it when `wikiExists` is true OR as part of the first-time onboarding when wiki doesn't exist yet.

Button behavior:
- While running: "Scanning N projects..." (disable button)
- On success: "Ingested N project files into wiki" (green toast, auto-dismiss 5s)
- On error: show error count and list first 3 errors (red)

The button should be styled similarly to the existing "Ingest" button.

### 4. Add a test for the new endpoint (server/routes/wiki.ts or a test file)

Add at minimum 2 tests to the existing wiki test file (if it exists) or create `server/routes/wiki.test.ts`:
- Returns 200 with `{ ingested: 0, errors: ['Ollama not available...'] }` when Ollama is mocked as unavailable
- Returns 200 with ingested count when projects are found (mock PROJECTS_DIR with temp dir)

### 5. Run tests and commit

- `npm test -- --reporter=dot`
- `git add -A && git commit -m "feat(TASK-037): wiki scan projects endpoint and UI button"`

## Acceptance Criteria
- [ ] `POST /api/wiki/ingest-projects` endpoint exists and works
- [ ] Returns `{ ingested: number, errors: string[] }` always HTTP 200
- [ ] Uses state file priority order for discovery
- [ ] Path traversal protection on all paths
- [ ] Checks Ollama availability before attempting ingest
- [ ] WikiPanel has "Scan Projects" button with progress feedback
- [ ] At least 2 new tests for the endpoint
- [ ] `npm test -- --reporter=dot` passes
- [ ] Committed

## Validation Gates
- [ ] `npm test -- --reporter=dot` passes
- [ ] `npx tsc --noEmit` shows no new type errors
- [ ] `git commit` done

## Files to Read First
- `server/routes/wiki.ts` — where to add new endpoint; understand existing patterns
- `server/lib/wiki-manager.ts` — `ingestSource` function signature
- `server/lib/state-reader.ts` — STATE_FILE_PRIORITY array to copy
- `server/lib/ollama-client.ts` — `getOllamaStatus` function
- `src/components/WikiPanel.tsx` — where to add the button
- `src/hooks/useWiki.ts` — where to add `ingestProjects` method

## Constraints
- Do NOT change `ingestSource` in wiki-manager.ts
- Do NOT change existing wiki endpoints
- Do NOT install new packages
- Do NOT recurse deeper than immediate subdirectories of PROJECTS_DIR (same as scanner)
- Do NOT ask questions — make reasonable assumptions and document them
