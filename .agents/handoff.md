# Handoff: Fix Obsidian deep links — configurable VAULT_NAME env var
**Task ID**: TASK-038
**Mode**: autonomous (no user interaction available)

## Context

**Project**: Cortex — local-only personal command center dashboard. React+Vite+TypeScript frontend on :5173, Express.js TypeScript backend on :3001. Repo at `C:\Users\boomb\Documents\_Projects\Brain2`.

**The bug**: Clicking "Open in Obsidian" links results in "Unable to find a vault for the URL" error. All `obsidian://` deep links are hardcoded with `vault=SecondBrain`, but the exact registered vault name in Obsidian may differ on the user's machine.

**Current hardcoded locations** (all frontend, no backend URLs found):

| File | Line | Current hardcode |
|------|------|-----------------|
| `src/components/CanvasPanel.tsx` | 32 | `const vault = 'SecondBrain'` |
| `src/components/DailyPanel.tsx` | 192 | `` `obsidian://open?vault=SecondBrain&...` `` |
| `src/components/KnowledgeGraph.tsx` | 19-21 | Returns hardcoded `'SecondBrain'` |
| `src/components/ReviewPanel.tsx` | 182, 243 | `` `obsidian://open?vault=SecondBrain&...` `` |

## Task

### 1. Add VAULT_NAME to .env.example

```
# The name of your Obsidian vault (must match exactly what Obsidian shows in top-left)
VAULT_NAME=SecondBrain
```

### 2. Create GET /api/config endpoint (server/routes/ — new file or add to existing)

Create `server/routes/config.ts`:

```typescript
import { Router } from 'express'
import { config } from 'dotenv'
config()

const router = Router()

router.get('/', (_req, res) => {
  res.json({
    vaultName: process.env.VAULT_NAME || 'SecondBrain',
    projectsDir: process.env.PROJECTS_DIR || '',
  })
})

export { router as configRouter }
```

Mount in `server/index.ts`: `app.use('/api/config', configRouter)`

### 3. Create useConfig hook (src/hooks/useConfig.ts)

```typescript
import { useState, useEffect } from 'react'

interface Config {
  vaultName: string
  projectsDir: string
}

export function useConfig() {
  const [config, setConfig] = useState<Config>({ vaultName: 'SecondBrain', projectsDir: '' })
  
  useEffect(() => {
    fetch('/api/config')
      .then(r => r.json())
      .then(setConfig)
      .catch(() => {}) // fall back to default
  }, [])
  
  return config
}
```

### 4. Update all frontend components

Replace every hardcoded `'SecondBrain'` in `obsidian://` URLs with the value from `useConfig()`.

**CanvasPanel.tsx**: Replace `const vault = 'SecondBrain'` with:
```typescript
const { vaultName } = useConfig()
```
And use `vaultName` in the URL.

**DailyPanel.tsx**: Import `useConfig`, call it at the top of the component, replace `SecondBrain` in the URL.

**KnowledgeGraph.tsx**: Replace the hardcoded `getVaultName()` function. Import and call `useConfig()` instead.

**ReviewPanel.tsx**: Import `useConfig`, call at component top, replace both hardcoded instances.

### 5. Run tests and commit

- `npm test -- --reporter=dot`
- `git add -A && git commit -m "fix(TASK-038): configurable VAULT_NAME for obsidian:// deep links"`

## Acceptance Criteria
- [ ] `VAULT_NAME` added to `.env.example` with comment
- [ ] `GET /api/config` returns `{ vaultName, projectsDir }`
- [ ] `useConfig` hook created in `src/hooks/useConfig.ts`
- [ ] All 4 components use `vaultName` from `useConfig()` instead of hardcoded string
- [ ] No hardcoded `'SecondBrain'` remains in `obsidian://` URLs in frontend components
- [ ] `npm test -- --reporter=dot` passes (same count)
- [ ] `npx tsc --noEmit` shows no new type errors
- [ ] Committed

## Validation Gates
- [ ] `npm test -- --reporter=dot` passes
- [ ] `npx tsc --noEmit` no new errors
- [ ] Grep: `grep -r "vault=SecondBrain" src/` returns no matches
- [ ] `git commit` done

## Files to Read First
- `src/components/CanvasPanel.tsx` — line 32, first hardcoded vault
- `src/components/DailyPanel.tsx` — line 192, hardcoded vault in handler
- `src/components/KnowledgeGraph.tsx` — lines 19-21, getVaultName function
- `src/components/ReviewPanel.tsx` — lines 182 and 243, two hardcoded vaults
- `server/index.ts` — where to mount the new configRouter
- `.env.example` — where to add VAULT_NAME

## Constraints
- Do NOT change any obsidian:// URL structure except replacing the vault name
- Do NOT add new test files for the config hook (keep scope small)
- Do NOT install new packages
- Do NOT ask questions — make reasonable assumptions and document them
