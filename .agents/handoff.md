# Handoff: In-App Command Palette (Ctrl+K)
**Task ID**: TASK-042
**Mode**: autonomous (no user interaction available)

## Context

**Project**: Cortex — local-only personal command center dashboard. React+Vite+TypeScript frontend on :5173, Express.js TypeScript backend on :3001. Repo at `C:\Users\boomb\Documents\_Projects\Brain2`.

**What exists**: QuickCapture component with Ctrl+K focus behavior. Multi-page routing with react-router (Home, Projects, Deadlines, Knowledge, Learning pages). POST /api/capture for quick capture. GET /api/projects for project list. Various action endpoints (POST /api/wiki/lint, POST /api/weekly/generate, etc.).

## Task

### 1. Install cmdk

```bash
npm install cmdk
```

### 2. Create CommandPalette component (`src/components/CommandPalette.tsx`)

Use the `cmdk` React library (Command component):

```tsx
import { Command } from 'cmdk'
```

Build the palette with:
- **Trigger**: Ctrl+K (or Cmd+K on Mac) opens the palette. Register a global `keydown` listener in App.tsx.
- **Search input**: cmdk handles fuzzy matching automatically
- **Result groups**:
  - **Navigate**: "Go to Projects", "Go to Deadlines", "Go to Knowledge", "Go to Learning", "Go to Home"
  - **Projects**: Dynamically loaded from GET /api/projects — "Open {projectName}" items. On select: `navigate('/projects/${slug}')`
  - **Actions**: "Run Wiki Lint" (POST /api/wiki/lint), "Generate Weekly Review" (POST /api/weekly/generate), "Capture to Inbox" (focus a capture input)
- **"Capture: {text}" shortcut**: If the search input starts with "Capture: ", pressing Enter sends the text after the prefix to POST /api/capture and shows a brief confirmation toast
- **Keyboard navigation**: cmdk handles arrow keys + Enter natively
- **Close**: Escape or clicking the backdrop

### 3. Style the palette

Add styles in `src/components/CommandPalette.css` or inline. cmdk provides CSS variables. Style it with:
- Dark semi-transparent backdrop
- Centered modal (max-width 640px)
- Rounded corners, shadow, dark background matching Cortex theme
- Group headers in muted color
- Highlighted selected item

### 4. Wire into App.tsx

- Import CommandPalette, render it at the app root level (outside routes)
- Manage open state with useState, toggled by Ctrl+K keydown listener
- Remove the old Ctrl+K focus behavior from QuickCapture (if it exists as a separate keybinding)

### 5. Run tests and commit

- `npm test -- --reporter=dot`
- `npx tsc --noEmit`
- `git add -A && git commit -m "feat(TASK-042): command palette with cmdk (Ctrl+K)"`

## Acceptance Criteria
- [ ] Ctrl+K opens command palette modal with search input
- [ ] Fuzzy search matches page routes, project names, and action names
- [ ] Arrow keys navigate results, Enter executes selected item
- [ ] "Capture: {text}" shortcut sends to POST /api/capture and shows confirmation
- [ ] Results grouped by type (Navigate / Projects / Actions)
- [ ] Escape closes palette, clicking backdrop closes palette
- [ ] Navigate actions use react-router useNavigate
- [ ] Action items trigger correct API calls
- [ ] QuickCapture Ctrl+K behavior replaced (not duplicated)
- [ ] Tests for fuzzy matching logic and keyboard navigation

## Validation Gates
- [ ] `npm test -- --reporter=dot` passes
- [ ] `npx tsc --noEmit` no new errors
- [ ] `git commit` done

## Files to Read First
- `src/App.tsx` — routing and global key listeners
- `src/components/QuickCapture.tsx` — existing Ctrl+K behavior to replace
- `server/routes/` — available action endpoints

## Constraints
- Use `cmdk` library — do NOT build a custom fuzzy search from scratch
- Do NOT remove the QuickCapture component entirely (it may still be used for inline capture), just remove its Ctrl+K keybinding
- Do NOT ask questions — make reasonable assumptions and document them
