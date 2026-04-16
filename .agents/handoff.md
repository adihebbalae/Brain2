# Handoff: Multi-account Claude chat sync
**Task ID**: TASK-019
**Mode**: autonomous (no user interaction available)

## Context

**Project**: Cortex — local-only personal command center. Express.js backend on :3001, React frontend on :5173.

**Stack**: React + Vite + TypeScript, Express.js (TypeScript), Tailwind CSS v4, Vitest.
**Package manager**: npm (NOT pnpm).
**Run tests**: `npm test`. `npm run type-check` must be clean.

**This task builds on TASK-014**. Read the files created in that task before starting. Check `git log` for recent changes.

**This task is INDEPENDENT of TASK-015 through TASK-018** — it can run concurrently or after them. It only touches the chat export system.

### What already exists (from TASK-014)
- `server/lib/chat-export-parser.ts` — `listConversations`, `searchConversations`, `getConversation`, `setConversationTags`
- `server/routes/chats.ts` — `GET /api/chats`, `GET /api/chats/search`, `GET /api/chats/:uuid`, `PATCH /api/chats/:uuid/tags`
- `src/hooks/useChats.ts` — data fetching hook with debounced search
- `src/components/ChatExplorer.tsx` — conversation list with search, tag editing, inline message expansion
- `VAULT_DIR/ChatExports/` — flat directory of Claude JSON exports  
- `VAULT_DIR/ChatExports/.tags.json` — sidecar file for tag storage

### 23 existing tests in `chat-export-parser.test.ts` — ALL must still pass.

### Current behavior (flat scan)
`chat-export-parser.ts` currently scans `ChatExports/*.json` — only top-level JSON files.

### What this task changes

**Make the scan recursive**: `ChatExports/**/*.json` — scan all subdirectories.

**Subfolder = account label**: If a JSON file is at `ChatExports/Personal/export.json`, the account is `"Personal"`. If at `ChatExports/export.json` (top-level), the account is `"default"`.

```
ChatExports/
  conversation-123.json        → account: "default" (backward compatible)
  Personal/
    conversation-456.json      → account: "Personal"
  Work/
    conversation-789.json      → account: "Work"
```

## Files to Read First
- `.agents/workspace-map.md` — full project structure
- `server/lib/chat-export-parser.ts` — all current logic (MUST understand before modifying)
- `server/lib/chat-export-parser.test.ts` — all 23 existing tests (must not break)
- `src/hooks/useChats.ts` — data hook (extend)
- `src/components/ChatExplorer.tsx` — extend with account badge and filter

## Task

### 1. Update TypeScript types

In `server/lib/chat-export-parser.ts` (or `src/types.ts` — follow existing pattern), add `account` field:

```ts
export interface ConversationMeta {
  uuid: string
  title: string
  createdAt: string
  updatedAt: string
  messageCount: number
  preview: string
  tags: string[]
  account: string  // ← ADD THIS. "default" for top-level files, subfolder name otherwise
}
```

### 2. Update `listConversations` in `chat-export-parser.ts`

Currently scans flat directory. Change to recursive with account derivation:

```ts
// Pseudocode for new scan logic:
function scanChatExports(exportDir: string): Array<{ filePath: string; account: string }> {
  const results = []
  
  // Top-level JSON files → account: "default"
  for (const file of fs.readdirSync(exportDir)) {
    if (file.endsWith('.json') && file !== '.tags.json') {
      results.push({ filePath: path.join(exportDir, file), account: 'default' })
    }
  }
  
  // One level of subdirectories → account: subfolder name
  for (const entry of fs.readdirSync(exportDir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      const accountName = entry.name
      const subDir = path.join(exportDir, accountName)
      for (const file of fs.readdirSync(subDir)) {
        if (file.endsWith('.json') && file !== '.tags.json') {
          results.push({ filePath: path.join(subDir, file), account: accountName })
        }
      }
    }
  }
  
  return results
}
```

**IMPORTANT**: Only go ONE level deep (direct subdirectories only). Do NOT recurse further.

Apply path traversal protection: each resolved file path must start with the resolved `ChatExports/` dir.

Update `listConversations` to call this, add `account` field to each `ConversationMeta`.

### 3. Update `searchConversations` in `chat-export-parser.ts`

- Include `account` field in all returned `ConversationMeta` objects
- Optionally accept an `account` filter: `searchConversations(query, exportDir, account?: string)` — if `account` provided, only include conversations from that account

### 4. Update `setConversationTags` / tags sidecar

Tags are stored in `.tags.json`. Currently keyed by UUID. No change needed — UUIDs are still unique across accounts, so tag storage is already correct.

### 5. Update `server/routes/chats.ts`

**`GET /api/chats`**: accepts optional query param `?account=Personal` — passes to `listConversations`. If omitted: return all accounts.

**`GET /api/chats/search`**: accepts optional `?account=Personal` alongside existing `?q=` param.

No other endpoint changes needed.

### 6. Update `src/hooks/useChats.ts`

Add `accounts` to the hook state:

```ts
interface ChatsState {
  conversations: ConversationMeta[]
  loading: boolean
  error: string | null
  accounts: string[]     // ← ADD: derived unique list from loaded conversations
  activeAccount: string | null  // ← ADD: currently selected filter (null = all)
  setActiveAccount: (account: string | null) => void
}
```

- `accounts`: derived from unique `conversation.account` values in the loaded list
- `setActiveAccount`: updates filter; triggers refetch with `?account=` param if non-null

### 7. Update `src/components/ChatExplorer.tsx`

**Account badge on each conversation**:
- If account is `"default"` OR if only one account exists: **don't show the badge** (backward-compatible UX)
- Otherwise: show a small badge on each conversation item: `bg-indigo-100 text-indigo-700 text-xs` with account name

**Account filter dropdown** (only show when 2+ accounts exist):
- Dropdown above the conversation list: `All accounts | Personal | Work | ...`
- Changing selection calls `setActiveAccount`
- Selection shown as active state on the dropdown option

### 8. Update tests in `chat-export-parser.test.ts`

**All 23 existing tests must still pass** — do not change their behavior.

Add new tests:
- `scanChatExports` with flat files only → all `account: "default"`
- `scanChatExports` with subfolder `Personal/export.json` → `account: "Personal"`
- `scanChatExports` with mixed flat + subfolder → correct account derivation
- `listConversations` returns `account` field in all results
- `searchConversations` with `account` filter returns only matching
- Path traversal: file in `ChatExports/../evil.json` → rejected
- Does NOT recurse 2+ levels deep

**`src/components/ChatExplorer.test.tsx`** (new or extend):
- Account badge hidden when all conversations have `account: "default"`
- Account badge shown when multiple accounts present
- Filter dropdown hidden when only 1 account
- Filter dropdown shown and functional when 2+ accounts

## Acceptance Criteria
- [ ] Flat exports (`ChatExports/*.json`) still loaded as `account: "default"` (backward compatible)
- [ ] Subfolder exports (`ChatExports/AccountName/*.json`) loaded with correct account name
- [ ] Only ONE level of subdirectories supported (no deeper recursion)
- [ ] `ConversationMeta` type includes `account: string`
- [ ] `GET /api/chats?account=X` filters by account
- [ ] ChatExplorer shows account badge when 2+ accounts present
- [ ] ChatExplorer shows account filter dropdown when 2+ accounts
- [ ] Account badge hidden for single-account users (clean UX for existing users)
- [ ] All 23 existing TASK-014 tests still pass
- [ ] New tests for recursive scan, account derivation, and filter
- [ ] `npm run type-check` clean

## Validation Gates
- [ ] `npm test` — all tests pass (including all 23 existing chat tests)
- [ ] `npm run type-check` — zero errors
- [ ] `git add -A && git commit -m "feat(TASK-019): multi-account Claude chat sync"`

## Constraints
- Do NOT break any of the 23 existing chat-export-parser tests
- Do NOT go more than ONE level deep into subdirectories
- Path traversal: all file reads must stay inside `ChatExports/`
- Account name comes from directory name only — do NOT read any metadata from the export JSON to determine account
- Do NOT change the tags storage format in `.tags.json`
- Do NOT add npm packages
