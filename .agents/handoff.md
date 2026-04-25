# Handoff: Local Semantic Search (nomic-embed-text + SQLite-vss)
**Task ID**: TASK-046
**Mode**: autonomous (no user interaction available)

## Context

**Project**: Cortex — local-only personal command center dashboard. React+Vite+TypeScript frontend on :5173, Express.js TypeScript backend on :3001. Repo at `C:\Users\boomb\Documents\_Projects\Brain2`.

**What exists**: RAG chat in `server/lib/rag-engine.ts` using keyword-based scoring (top-20 chunks, 6000-char context). Wiki query in `server/lib/wiki-manager.ts`. BrainChat component in `src/components/BrainChat.tsx`. Ollama client in `server/lib/ollama-client.ts`.

**Important**: This is the largest and most complex task. It introduces a new dependency layer (embeddings + vector search). Take extra care with error handling and graceful fallbacks.

## Task

### 1. Install dependencies

```bash
npm install better-sqlite3
npm install -D @types/better-sqlite3
```

Note: `sqlite-vss` may not be available as a direct npm package on Windows. If sqlite-vss is not installable, use a pure JavaScript cosine similarity implementation over stored embedding arrays instead. The key requirement is local embeddings via Ollama, NOT a specific vector DB.

**Fallback strategy**: If sqlite-vss doesn't work, store embeddings as JSON arrays in a SQLite table (using better-sqlite3) and compute cosine similarity in JavaScript. This is slower but eliminates the native extension dependency.

### 2. Create `server/lib/embedding-index.ts`

Core module:

```typescript
export async function initializeIndex(): Promise<void>       // called on startup
export async function searchSemantic(query: string, limit?: number): Promise<SearchResult[]>
export function getIndexStatus(): { totalChunks: number, lastUpdated: string, isIndexing: boolean }
```

**Initialization**:
- Create `data/cortex-embeddings.db` (SQLite via better-sqlite3)
- Table schema: `chunks(id INTEGER PRIMARY KEY, filePath TEXT, chunkIndex INTEGER, content TEXT, embedding TEXT, mtime REAL)`
  - `embedding` stores JSON array of floats
- Scan VAULT_DIRS + PROJECTS_DIR for all `.md` files
- Compare file mtimes against stored mtimes → only re-embed changed/new files
- For each new/changed file:
  - Chunk by paragraph/heading boundary (~500 chars per chunk)
  - Call Ollama embeddings API: `POST http://localhost:11434/api/embeddings` with model `nomic-embed-text` and each chunk
  - Store chunk + embedding in SQLite
- Run indexing in background (don't block server startup)
- Log progress: `[embeddings] Indexing 45/120 files...`

**Chunking logic** (`chunkText(text: string, maxChars: number = 500): string[]`):
- Split by `\n\n` (paragraph boundaries)
- If a paragraph exceeds maxChars, split further by `\n` (line boundaries)
- If a line exceeds maxChars, split by sentence (`. `)
- Each chunk gets a small overlap (50 chars) from the previous chunk for context

**Search**:
- Embed the query using the same Ollama endpoint
- Compute cosine similarity between query embedding and all stored embeddings
- Return top-N results sorted by similarity, with `{ filePath, content, score }`

**Cosine similarity** (pure JS):
```typescript
function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0, magA = 0, magB = 0
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i]
    magA += a[i] * a[i]
    magB += b[i] * b[i]
  }
  return dot / (Math.sqrt(magA) * Math.sqrt(magB))
}
```

### 3. Add GET /api/search route

In `server/routes/` (new file `search.ts`):
- `GET /api/search?q={query}&mode=semantic|keyword`
- `mode=semantic` (default): use embedding-index.ts
- `mode=keyword`: use existing keyword search from rag-engine.ts
- Return `{ results: { filePath, content, score }[], mode }` 
- If embeddings unavailable (Ollama down, index not built), auto-fallback to keyword mode

### 4. Update rag-engine.ts

- When semantic index is available, use `searchSemantic()` for chunk retrieval instead of keyword scoring
- Keep keyword scoring as fallback
- Don't break the existing BrainChat flow

### 5. Add search mode toggle to BrainChat

In `src/components/BrainChat.tsx`:
- Add a small toggle or dropdown in the chat header: "Semantic" / "Keyword"
- Pass mode to the chat API or directly to the search endpoint
- Default to semantic when available

### 6. Add to .gitignore

```
data/cortex-embeddings.db
```

### 7. Call initializeIndex() on server startup

In `server/index.ts`, after other services start:
```typescript
import { initializeIndex } from './lib/embedding-index'
initializeIndex().catch(err => console.warn('[embeddings] Index init failed:', err))
```

### 8. Run tests and commit

- `npm test -- --reporter=dot`
- `npx tsc --noEmit`
- `git add -A && git commit -m "feat(TASK-046): local semantic search with nomic-embed-text embeddings"`

## Acceptance Criteria
- [ ] Initial embedding index built on first startup (async, non-blocking)
- [ ] Progress logged to console during indexing (N/total files)
- [ ] Incremental updates on subsequent startups (only changed files re-embedded)
- [ ] GET /api/search?mode=semantic returns cosine-similarity ranked results
- [ ] GET /api/search?mode=keyword returns existing keyword-based results
- [ ] RAG chat (rag-engine.ts) uses semantic scoring when index available
- [ ] Fallback to keyword scoring when Ollama or embeddings unavailable
- [ ] data/cortex-embeddings.db in .gitignore
- [ ] Chunking splits by paragraph/heading boundaries (~500 chars each)
- [ ] Tests for chunking logic, incremental update detection, and cosine similarity

## Validation Gates
- [ ] `npm test -- --reporter=dot` passes
- [ ] `npx tsc --noEmit` no new errors
- [ ] `git commit` done

## Files to Read First
- `server/lib/rag-engine.ts` — existing keyword-based RAG scoring
- `server/lib/ollama-client.ts` — Ollama API integration
- `server/lib/wiki-manager.ts` — existing wiki search
- `src/components/BrainChat.tsx` — chat UI to add toggle
- `server/index.ts` — startup sequence

## Constraints
- Do NOT require a separate vector database service (Neo4j, ChromaDB, etc.)
- If sqlite-vss is not available on Windows, use pure JS cosine similarity over stored JSON arrays
- Embedding indexing MUST be async and non-blocking (server must respond to requests during indexing)
- data/cortex-embeddings.db MUST be gitignored
- Do NOT ask questions — make reasonable assumptions and document them
