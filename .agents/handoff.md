# Handoff: Fix project summaries — use state-file content, not hallucinated AI
**Task ID**: TASK-036
**Mode**: autonomous (no user interaction available)

## Context

**Project**: Cortex — local-only personal command center dashboard. React+Vite+TypeScript frontend on :5173, Express.js TypeScript backend on :3001. Repo at `C:\Users\boomb\Documents\_Projects\Brain2`.

**The bug**: Project cards on the dashboard show "wacky" AI-generated summaries — the AI invents details that aren't in the project state files. There are two root causes:

1. **Ollama 404**: When Ollama returns a 404 (model not pulled), the error is swallowed silently. There's no log message telling the user to run `ollama pull llama3.1:8b`, so the AI returns garbage or errors that appear as summaries.

2. **Weak AI prompt**: The prompt in `server/lib/ollama-client.ts` (function `summarizeProject`) doesn't constrain the AI tightly enough, allowing hallucination.

3. **Summary display priority**: `src/components/ProjectCard.tsx` already shows `project.summary` (from the state file) as primary content and `project.aiSummary` as secondary. This is correct — but the AI summary section appears even when `aiSummary` is a hallucinated/error string. Need to ensure bad AI summaries don't display.

**Key files**:
- `server/lib/ollama-client.ts` — `summarizeProject` function, contains the Ollama API call and prompt
- `src/components/ProjectCard.tsx` — renders the card with summary and aiSummary fields
- `server/routes/ai.ts` — `/api/ai/summarize/:project` endpoint

## Task

### 1. Fix the Ollama prompt (server/lib/ollama-client.ts)

Find the `summarizeProject` function. Update the prompt to be factual-only:

```
You are reading a project state file. In 2-3 sentences, describe exactly where the developer left off based ONLY on what is written in this file. Do not invent details. Do not guess. If the file doesn't have enough information, say "State file has limited context." Be concise and direct.

State file content:
[content here]
```

### 2. Add clear error logging for 404 (server/lib/ollama-client.ts and server/routes/ai.ts)

In `summarizeProject`, when the Ollama API returns a non-ok response, log clearly:
```
if (response.status === 404) {
  console.error('[ollama] Model not found (404). Run: ollama pull llama3.1:8b')
}
```

Return `{ summary: null, error: 'model_not_found' }` for 404 responses so the frontend knows to hide the AI section entirely.

### 3. Ensure ProjectCard hides AI summary on error (src/components/ProjectCard.tsx)

The current code: `{project.aiSummary && (...)}` already hides the AI section when `aiSummary` is null/undefined/empty. This is correct. Just verify the `aiSummary` field in `src/types.ts` is typed as `string | null | undefined` so null is valid. No visual changes needed if this is already correct.

### 4. Run tests and commit

- `npm test -- --reporter=dot` — verify same pass count (608+ passing)
- `git add -A && git commit -m "fix(TASK-036): factual AI prompt, 404 error logging for ollama model not found"`

## Acceptance Criteria
- [ ] Ollama prompt updated to be factual-only with explicit instruction not to invent details
- [ ] 404 response from Ollama logs: `[ollama] Model not found (404). Run: ollama pull llama3.1:8b`
- [ ] null returned from summarizeProject on 404 (not a fabricated string)
- [ ] ProjectCard correctly hides aiSummary section when value is null
- [ ] `npm test -- --reporter=dot` passes with same count
- [ ] Committed

## Validation Gates
- [ ] `npm test -- --reporter=dot` passes
- [ ] `npx tsc --noEmit` shows no new type errors
- [ ] `git commit` done

## Files to Read First
- `server/lib/ollama-client.ts` — contains `summarizeProject`, prompt, and API call
- `server/routes/ai.ts` — endpoint that calls summarizeProject
- `src/components/ProjectCard.tsx` — renders aiSummary
- `src/types.ts` — ProjectCard prop types
- `server/lib/ollama-client.test.ts` — existing tests to keep passing

## Constraints
- Do NOT change the visual layout of ProjectCard beyond what's needed
- Do NOT add new dependencies
- Do NOT change the `project.summary` field (from state file) — it should remain the primary summary
- Do NOT ask questions — make reasonable assumptions and document them
