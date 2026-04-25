# Handoff: Kanban Triage Board (checkbox → drag-and-drop columns)
**Task ID**: TASK-045
**Mode**: autonomous (no user interaction available)

## Context

**Project**: Cortex — local-only personal command center dashboard. React+Vite+TypeScript frontend on :5173, Express.js TypeScript backend on :3001. Repo at `C:\Users\boomb\Documents\_Projects\Brain2`.

**What exists**: TODO extractor (`server/lib/todo-extractor.ts`) parses `- [ ]` (unchecked) and `- [x]` (checked) from markdown files across PROJECTS_DIR and VAULT_DIRS. Existing PATCH /api/todos/:id toggles checkboxes by rewriting the source file. Multi-page routing with NavBar links.

## Task

### 1. Extend TODO extractor to recognize `- [/]`

In `server/lib/todo-extractor.ts`:
- Add recognition of `- [/]` as an "in_progress" type/status
- The existing regex likely matches `- [ ]` and `- [x]`. Extend it to also match `- [/]`
- Add a `status` field to the Todo type: `'todo' | 'doing' | 'done'`
  - `- [ ]` → `'todo'`
  - `- [/]` → `'doing'`
  - `- [x]` → `'done'`

### 2. Add GET /api/kanban route

In `server/routes/` (new file `kanban.ts`):
- Returns `{ todo: Todo[], doing: Todo[], done: Todo[] }` — TODOs grouped by status
- Reuses the existing TODO extraction logic

### 3. Add PATCH /api/todos/:id/status route

In `server/routes/todos.ts`:
- Accepts `{ status: 'todo' | 'doing' | 'done' }`
- Reads the source file, finds the TODO line by ID
- Rewrites the checkbox marker:
  - `'todo'` → `- [ ]`
  - `'doing'` → `- [/]`
  - `'done'` → `- [x]`
- **Critical**: Must not corrupt the rest of the file content. Read file, replace only the specific checkbox characters, write back.

### 4. Create KanbanBoard page (`src/pages/KanbanBoard.tsx`)

Three-column layout:
- **To Do** (left) — items with `- [ ]`
- **In Progress** (center) — items with `- [/]`
- **Done** (right) — items with `- [x]`

Each card shows:
- TODO text (truncated if long)
- Project name badge (colored)
- Source file name chip

**Drag-and-drop**: Use HTML5 Drag and Drop API (no external library):
- `draggable="true"` on cards
- `onDragStart` sets the todo ID in dataTransfer
- `onDragOver` on columns with `e.preventDefault()`
- `onDrop` on columns reads the ID, calls PATCH /api/todos/:id/status with the target column's status
- Visual feedback: highlight the target column on dragover

**Filter**: Add a dropdown at the top to filter by project name.

### 5. Add to routing and NavBar

- Add `/kanban` route in App.tsx
- Add "Kanban" link to NavBar with a board icon

### 6. Run tests and commit

- `npm test -- --reporter=dot`
- `npx tsc --noEmit`
- `git add -A && git commit -m "feat(TASK-045): kanban triage board with drag-and-drop"`

## Acceptance Criteria
- [ ] `- [/]` recognized as 'in_progress' type by TODO extractor
- [ ] GET /api/kanban returns `{todo: Todo[], doing: Todo[], done: Todo[]}`
- [ ] PATCH /api/todos/:id/status writes correct checkbox marker to source file
- [ ] Status transitions: todo↔doing↔done (all directions allowed)
- [ ] Frontend drag-and-drop moves cards between columns
- [ ] Write-back doesn't corrupt file content
- [ ] Filter dropdown by project name
- [ ] NavBar includes Kanban link
- [ ] /kanban route renders correctly
- [ ] Tests for [/] parsing, status transitions, and write-back correctness

## Validation Gates
- [ ] `npm test -- --reporter=dot` passes
- [ ] `npx tsc --noEmit` no new errors
- [ ] `git commit` done

## Files to Read First
- `server/lib/todo-extractor.ts` — the TODO parsing regex and types
- `server/routes/todos.ts` — existing PATCH endpoint for toggle
- `src/App.tsx` — routing setup
- `src/components/NavBar.tsx` — to add Kanban link

## Constraints
- Do NOT install any drag-and-drop library — use HTML5 native DnD API
- The PATCH /api/todos/:id/status write-back MUST be safe (read file, replace only the checkbox, write back)
- Path traversal protection on file operations
- Do NOT ask questions — make reasonable assumptions and document them
