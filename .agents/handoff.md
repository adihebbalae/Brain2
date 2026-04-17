╔══════════════════════════════════════════════════════════════╗
║  🔀 SWITCH TO:  @engineer   |   MODEL:  Sonnet             ║
╚══════════════════════════════════════════════════════════════╝

# Handoff: Article/Bookmark Reading Tracker
**From**: Manager → **To**: Engineer | **Model**: claude-sonnet-4-5
**Date**: 2026-04-16 | **Task ID**: TASK-022

## Context
Cortex is a local-only personal command center running on localhost. Backend: Express.js TypeScript on `:3001`. Frontend: React + Vite + TypeScript + Tailwind CSS on `:5173`. No database — all data read from local files.

WHY this matters: The user saves dozens of articles and links but never reviews them. Surfacing "you saved this 2 weeks ago and haven't read it" closes the loop and makes the dashboard actionable for learning, not just project tracking. This is bookmarks + saved links ONLY — not full browser history.

**Package manager**: npm (NOT pnpm)
**Test framework**: Vitest

## Task

### 1. Chrome Bookmarks parser (`server/lib/bookmarks-parser.ts`)
Chrome bookmarks file at `%LOCALAPPDATA%\Google\Chrome\User Data\Default\Bookmarks` (JSON, read-only, no lock issues). Structure:
```json
{
  "roots": {
    "bookmark_bar": { "children": [...] },
    "other": { "children": [...] },
    "synced": { "children": [...] }
  }
}
```
Each leaf node (type=`"url"`) has: `name`, `url`, `date_added` (Windows FILETIME: microseconds since Jan 1, 1601). Folders (type=`"folder"`) have `children` arrays — recurse.

Parser should:
- Recursively walk all three roots
- Extract all `type: "url"` nodes
- Convert `date_added` to JS Date: `new Date(parseInt(date_added) / 1000 - 11644473600000)`
- Return: `{ name, url, addedAt, source: 'bookmarks' }[]`

Platform path constant: `process.env.CHROME_BOOKMARKS_PATH || path.join(process.env.LOCALAPPDATA || '', 'Google', 'Chrome', 'User Data', 'Default', 'Bookmarks')`

### 2. ReadingLog parser (`server/lib/reading-log-parser.ts`)
Parse `VAULT_DIR/Resources/ReadingLog.md`. Supported formats:
```markdown
- [ ] 2026-04-10 | [Title](https://url.com) | tag
- [x] 2026-04-10 | [Title](https://url.com) | optional-tag
- [ ] [Title](https://url.com)
```
Regex for each line: `^\s*-\s*\[([ x])\]\s*(?:(\d{4}-\d{2}-\d{2})\s*\|)?\s*\[([^\]]+)\]\(([^)]+)\)(?:\s*\|(.*))?`
Return: `{ title, url, read: boolean, date?: string, tags: string[], source: 'reading-log' }[]`

Create `VAULT_DIR/Resources/ReadingLog.md` if it doesn't exist (empty file with a header comment).

### 3. Route (`server/routes/reading.ts`)
`GET /api/reading?status=all|read|unread` — merges both sources:
- Deduplicate by URL (normalize: lowercase, strip trailing slash, strip `www.`)
- ReadingLog items take precedence for `read` status
- Response:
```typescript
{
  total: number,
  unread: number,
  read: number,
  items: ReadingItem[],  // sorted by date desc
  topTopics: { topic: string, count: number }[]  // keyword clusters
}
```

For `topTopics`: extract the 3 most significant words from each title (lowercase, filter stopwords like "the/a/an/of/in/to/how/why/what/is/are"). Count across all items. Return top 10 topics.

### 4. Frontend `ReadingPanel` component (`src/components/ReadingPanel.tsx`)
- Header: "Reading List" + unread count badge
- Toggle tabs: All / Unread / Read
- Item rows: title as link (opens URL in new tab), source badge (chrome/vault), date
- Bottom section: "Top Topics" — horizontal tag chips with counts (e.g. `react 12`, `typescript 8`)
- Quick add: input box with placeholder "https://... — add to reading list" — POSTs to `/api/reading` (see below)

### 5. Quick add route
`POST /api/reading` body: `{ url: string, title?: string }` — appends a `- [ ] [date] | [title](url)` line to `ReadingLog.md`. Title defaults to domain name if not provided.

## Acceptance Criteria
- [ ] Chrome bookmarks tree correctly flattened (recursion works)
- [ ] `date_added` Windows FILETIME conversion is correct
- [ ] `ReadingLog.md` both `[ ]` and `[x]` states parsed
- [ ] `GET /api/reading` merges + deduplicates by URL
- [ ] `topTopics` keyword extraction returns meaningful clusters
- [ ] `POST /api/reading` appends to ReadingLog.md correctly
- [ ] `ReadingPanel` renders with tabs and topic chips
- [ ] `ReadingLog.md` auto-created if missing
- [ ] Graceful when Chrome bookmarks file not found
- [ ] Tests for bookmarks parser (use fixture JSON), ReadingLog parser (use fixture md), and dedup logic
- [ ] All existing tests still pass

## Validation Gates
- [ ] `npm test` — all tests pass
- [ ] `npm run build` — no TypeScript errors
- [ ] `GET /api/reading` returns valid shape when both sources empty
- [ ] Path traversal check: `POST /api/reading` must not allow arbitrary path writes

## Files to Read First
- `server/lib/` — see existing parser patterns
- `server/routes/todos.ts` or `server/routes/capture.ts` — see write-back route pattern
- `src/components/` — see existing component structure
- `.github/copilot-instructions.md` — re-read file write-back security rules

## Constraints
- Saved links + bookmarks ONLY — do NOT read Chrome history (History SQLite file is off-limits)
- Do NOT write to any file other than `ReadingLog.md` for the POST endpoint
- Path of `ReadingLog.md` must be scoped to `VAULT_DIR` — validate it doesn't escape
- The Chrome Bookmarks file is read-only — never write to it
