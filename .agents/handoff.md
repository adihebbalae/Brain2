# Handoff: Chat export viewer (import, search, tag)
**Task ID**: TASK-014
**Mode**: autonomous (no user interaction available)

## Context

**Project**: Cortex — local-only personal command center. Express.js backend on :3001, React frontend on :5173.

**This task builds on TASK-011 (full integration)**. The vault directory already has a `ChatExports/` folder at `VAULT_DIR/ChatExports/`. Claude conversation exports are JSON files downloaded from Claude.ai → Settings → Export Data.

**Claude export format** (each file is a JSON array of conversations):
```json
[
  {
    "uuid": "...",
    "name": "Conversation title",
    "created_at": "2026-03-15T10:20:00Z",
    "updated_at": "2026-03-16T08:00:00Z",
    "chat_messages": [
      {
        "uuid": "...",
        "sender": "human" | "assistant",
        "text": "...",
        "created_at": "2026-03-15T10:20:00Z"
      }
    ]
  }
]
```

**User workflow**: User drops JSON export files into `VAULT_DIR/ChatExports/`. Dashboard shows them with search + project tagging. Tags are stored in a sidecar file `VAULT_DIR/ChatExports/.tags.json`.

## Task

### Files to create:

#### `server/lib/chat-export-parser.ts`

```ts
export interface ChatMessage {
  uuid: string
  sender: 'human' | 'assistant'
  text: string
  createdAt: string
}

export interface Conversation {
  uuid: string
  name: string
  createdAt: string
  updatedAt: string
  messageCount: number
  preview: string        // first human message, truncated to 200 chars
  tags: string[]
  sourceFile: string     // filename only, not full path
}

export interface ConversationDetail extends Conversation {
  messages: ChatMessage[]
}

export async function listConversations(vaultDir: string): Promise<Conversation[]>
export async function getConversation(vaultDir: string, uuid: string): Promise<ConversationDetail | null>
export async function searchConversations(vaultDir: string, query: string): Promise<Conversation[]>
export async function setConversationTags(vaultDir: string, uuid: string, tags: string[]): Promise<void>
```

**`listConversations`**:
- Scan `VAULT_DIR/ChatExports/` for `*.json` files (skip `.tags.json`)
- Parse each file as a JSON array of conversations
- Load tags from `.tags.json` sidecar and merge
- Sort by `updatedAt` descending
- Return `Conversation[]` (no messages — keep response light)

**`searchConversations`**:
- Case-insensitive full-text search across: conversation name, all message text
- Returns conversations matching the query, sorted by relevance (matches in name rank higher)

**`setConversationTags`**:
- Read/update `VAULT_DIR/ChatExports/.tags.json` (format: `{ [uuid]: string[] }`)
- Atomic write (write to temp file, then rename)

**Path security**: All file reads MUST be scoped to `VAULT_DIR/ChatExports/`. Reject any path that escapes this directory.

#### `server/routes/chats.ts`

```ts
GET  /api/chats              — list all conversations (no messages)
GET  /api/chats/search?q=... — full-text search
GET  /api/chats/:uuid        — single conversation with full messages
PATCH /api/chats/:uuid/tags  — body: { tags: string[] }, update tags
```

Mount in `server/index.ts`:
```ts
import { chatsRouter } from './routes/chats'
app.use('/api/chats', chatsRouter)
```

#### Frontend: `src/components/ChatExplorer.tsx`

Add as a new dashboard section (below the main two-column grid in App.tsx):

**Conversation list**:
- Shows: title, date (relative), message count, preview (first 100 chars of first human message), tag chips
- Search bar (debounced 300ms, calls `GET /api/chats/search?q=...`)
- Click to expand inline (or show full message thread in a slide-over panel)
- Empty state: "Drop Claude export JSON files into `SecondBrain/ChatExports/` to get started"

**Tag autocomplete**:
- When assigning tags, suggest existing project names from the projects API
- Allow free-text tags too
- Pill display with x to remove

**Message thread view** (inline expand):
- Human messages: right-aligned, blue bubble
- Assistant messages: left-aligned, gray bubble
- Truncate long messages with "Show more"

#### `src/hooks/useChats.ts`

```ts
export function useChats() {
  // returns { conversations, loading, error, search, setSearch, tagConversation, refetch }
  // search state drives debounced API calls
  // tagConversation(uuid, tags) calls PATCH and updates local state
}
```

### Tests: `server/lib/chat-export-parser.test.ts`

Use a temp directory with fixture JSON files:
- `listConversations` returns all conversations across multiple export files
- `searchConversations` matches in message text (case-insensitive)
- `setConversationTags` writes to `.tags.json` and returns tags on next `listConversations`
- Security: path traversal in uuid parameter is rejected

## Acceptance Criteria
- [ ] `GET /api/chats` returns conversation list without message bodies
- [ ] `GET /api/chats/search?q=ollama` returns matching conversations
- [ ] `GET /api/chats/:uuid` returns full message thread
- [ ] `PATCH /api/chats/:uuid/tags` persists tags to `.tags.json`
- [ ] Tags survive server restart (persisted, not in-memory)
- [ ] ChatExplorer renders in dashboard with search bar
- [ ] Tag editing with project-name autocomplete works
- [ ] Empty state appears when `ChatExports/` is empty
- [ ] Path traversal rejected on all endpoints
- [ ] Tests pass

## Validation Gates
- [ ] `npm run type-check` → zero errors
- [ ] `npm test` → all tests green

## Constraints
- Do NOT load full message text in `listConversations` — only `preview` (keeps the list fast)
- Do NOT store tags inside the export JSON files — sidecar `.tags.json` only  
- Search must work offline — no external search service
- Tag suggestions pull from existing `/api/projects` response (reuse, don't duplicate)
- The ChatExplorer section is optional-render: if `ChatExports/` has no `.json` files, render nothing (no empty section taking up space)

## On Completion
```
git add -A
git commit -m "feat(TASK-014): chat export viewer with search and project tagging"
```

Update `.agents/state.json` tasks.TASK-014.status to "done".
Update `.agents/state.json` `active_task` to null.
