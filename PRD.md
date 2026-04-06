# PRD: Second Brain Dashboard ("Cortex")

## Overview

A local-only personal command center that aggregates all of Adi's projects, deadlines, TODOs, and knowledge into a single web dashboard. It reads existing markdown project state files from `~/_Projects/`, pulls deadlines from Google Calendar and Apple Reminders (via iCloud), extracts TODOs automatically, and provides an at-a-glance view of everything in one place. Optionally uses Claude API for light AI features (summarization, TODO extraction from prose).

**This is a personal tool. No auth, no deployment, no multi-user. Runs on `localhost`.**

---

## System Context

- **OS:** Windows
- **Projects directory:** `~/_Projects/` — each subfolder is a project, each project contains an `agent_state.md` or `state.md` file documenting current status for coding agents
- **Deadline sources:** Google Calendar (API), Apple Reminders (iCloud.com web scrape or manual sync — no native CLI on Windows)
- **AI chats:** Multiple Claude accounts, some Gemini history. Exportable as JSON/ZIP from each platform's settings.
- **Existing workflow:** A single notes file with "things to do if time" list, project ideas, and in-progress items — all unstructured
- **Obsidian:** Will set up a new vault as part of this project

---

## Architecture

```
~/_Projects/                    ← existing, untouched
  ├── TutorOS/
  │   └── agent_state.md
  ├── NeuralGTO/
  │   └── agent_state.md
  ├── HoopIQ/
  │   └── state.md
  └── ...

~/SecondBrain/                  ← new Obsidian vault
  ├── .obsidian/                ← Obsidian config
  ├── Inbox/                    ← quick capture
  ├── Projects/                 ← symlinks to ~/_Projects/* folders
  ├── Areas/                    ← ongoing (school, tutoring, poker)
  ├── Resources/                ← reference material
  ├── Archive/                  ← completed/abandoned
  ├── ChatExports/              ← exported Claude/Gemini conversations
  ├── Deadlines/                ← manually maintained or synced
  ├── DailyNotes/               ← YYYY-MM-DD.md daily logs
  └── _dashboard/               ← the dashboard app lives here
      ├── package.json
      ├── vite.config.ts
      ├── src/
      │   ├── App.tsx
      │   ├── scanner.ts        ← reads project state files
      │   ├── todo-extractor.ts  ← extracts TODOs from markdown
      │   ├── calendar.ts        ← Google Calendar API integration
      │   ├── reminders.ts       ← Apple Reminders integration
      │   └── components/
      │       ├── ProjectCard.tsx
      │       ├── DeadlineTimeline.tsx
      │       ├── TodoAggregator.tsx
      │       ├── QuickCapture.tsx
      │       └── StatusOverview.tsx
      └── server/
          ├── index.ts           ← Express server, reads filesystem
          ├── routes/
          │   ├── projects.ts
          │   ├── todos.ts
          │   ├── deadlines.ts
          │   └── ai.ts          ← optional Claude API calls
          └── lib/
              ├── markdown-parser.ts
              ├── state-reader.ts
              └── gcal-client.ts
```

### Tech Stack

| Layer | Choice | Rationale |
|-------|--------|-----------|
| Frontend | React + Vite | Fast, minimal config, Adi knows React |
| Styling | Tailwind CSS | Rapid iteration, no design system needed |
| Backend | Express.js (TypeScript) | Lightweight, reads local filesystem |
| Calendar | Google Calendar API (OAuth2) | Native REST API, well-documented |
| Reminders | Manual markdown file OR iCloud web session | No Apple Reminders CLI on Windows; fallback to a `deadlines.md` file the dashboard reads |
| AI (optional) | Claude API (claude-sonnet-4-20250514) | Light summarization, TODO extraction from prose |
| Knowledge base | Obsidian vault (plain markdown) | Claude Code can operate on it directly |
| Package manager | pnpm | Fast, disk-efficient |

---

## Features (Priority Order)

### P0 — Core Dashboard (MVP, build first)

#### 1. Project Scanner & Status Cards
- On load, recursively scan `~/_Projects/` for any file matching `agent_state.md`, `state.md`, `Agent_State.json`, `Status.md`, or `README.md` (in that priority order)
- Parse each file and extract:
  - **Project name** (from folder name)
  - **Status** (look for frontmatter `status:` field, or infer from content — keywords like "in progress", "blocked", "not started", "completed")
  - **Last modified date** of the state file
  - **Current phase / next steps** (extract the first `## Next Steps` or `## TODO` section, or the last 3 bullet points)
- Display as cards in a grid, sorted by last-modified (most recent first)
- Each card shows: project name, status badge (color-coded), last touched date, 2-3 line summary of where things stand, and a "Open in VS Code" button (`code ~/\_Projects/ProjectName`)
- **Stale project warning:** If a project hasn't been touched in >14 days, show an amber indicator. >30 days = red.

#### 2. TODO Aggregator
- Scan ALL markdown files in `~/_Projects/` and `~/SecondBrain/` for:
  - `- [ ] ` unchecked tasks
  - `- [x] ` checked tasks (for completion stats)
  - Lines starting with `TODO:` or `FIXME:` or `HACK:`
- Group TODOs by source project
- Show total count, per-project count, and a flat list sortable by project or file
- Allow marking TODOs as done from the dashboard (writes back to the markdown file)

#### 3. Deadline Timeline
- Read from a `~/SecondBrain/Deadlines/deadlines.md` file with format:
  ```markdown
  ## Deadlines

  - [ ] 2026-04-10 | ECE319H Lab 8 due
  - [ ] 2026-04-15 | M325K Homework 9
  - [ ] 2026-04-20 | TutorOS MVP demo
  - [x] 2026-04-01 | M325K Midterm 3
  ```
- Display as a vertical timeline, color-coded by urgency:
  - Red: due within 48 hours
  - Amber: due within 7 days
  - Green: due later
  - Gray: completed
- **Google Calendar integration (stretch for MVP):** Pull events from a specific calendar via Google Calendar API, merge with manual deadlines. Requires one-time OAuth2 setup.

#### 4. Quick Capture
- A text input at the top of the dashboard
- Type a thought/TODO/idea, hit enter
- Appends to `~/SecondBrain/Inbox/inbox.md` with timestamp
- Format: `- [ ] [2026-04-05 14:32] Your captured thought here`
- This is the "dump" — process later in Obsidian

### P1 — Enhanced Features (build after MVP works)

#### 5. Google Calendar Sync
- OAuth2 flow (one-time browser auth, store refresh token locally in `.env`)
- Pull events from all calendars or a filtered set
- Display upcoming 14 days alongside manual deadlines
- Read-only — no writing back to Google Calendar

#### 6. Apple Reminders Bridge
- **On Windows, there is no native Apple Reminders CLI.**
- Options (implement one):
  - **(Recommended)** Maintain a `~/SecondBrain/Deadlines/reminders.md` file manually or sync it from iPhone via iCloud Drive
  - **(Alternative)** Use `icloud` npm package to authenticate to iCloud web and pull reminders — fragile but automated
  - **(Alternative)** Use a Shortcut on iPhone that exports reminders to a markdown file in iCloud Drive, which syncs to Windows
- Dashboard reads whatever file exists and merges into the deadline timeline

#### 7. Light AI Features
- **"Where did I leave off?" button** on each project card
  - Sends the project's state file content to Claude API
  - Returns a 2-3 sentence summary: what was done, what's next, what's blocking
  - Cache the response for 1 hour (don't re-call on every page load)
- **Auto-TODO extraction from prose**
  - For state files that don't use `- [ ]` format, use Claude API to extract implied action items from the prose
  - Show these as "suggested TODOs" in a separate section (non-destructive, doesn't write to files)

#### 8. Chat Export Viewer
- Import Claude conversation exports (JSON from Settings > Account > Export Data)
- Store in `~/SecondBrain/ChatExports/`
- Parse and display conversation list with titles, dates, and preview
- Search across all conversations
- Tag conversations with project names for cross-referencing

### P2 — Nice to Have (build if time)

#### 9. Obsidian Graph Integration
- Use Obsidian's `[[wikilink]]` format in state files and notes
- Dashboard shows a simplified graph of linked notes/projects
- Use D3.js force-directed graph

#### 10. Daily Notes
- Auto-generate `~/SecondBrain/DailyNotes/YYYY-MM-DD.md` each day
- Template:
  ```markdown
  # 2026-04-05

  ## Focus today
  -

  ## Done
  -

  ## Captured
  - (auto-populated from Quick Capture inbox)
  ```

#### 11. "Shiny Object" Detector
- Track how many projects are in "in progress" state simultaneously
- If >3 projects are active and none have been touched in the last 3 days, show a nudge: "You have 5 active projects but haven't touched any in 3 days. Pick one and ship it."
- Track project start dates and show average time-to-completion or time-to-abandonment

---

## Data Flow

```
┌─────────────────────┐
│  ~/_Projects/*      │──── filesystem scan ────┐
│  (state files)      │                         │
└─────────────────────┘                         │
                                                ▼
┌─────────────────────┐              ┌─────────────────────┐
│  ~/SecondBrain/     │──── read ───▶│  Express Backend    │
│  (vault, deadlines, │              │  localhost:3001      │
│   inbox, exports)   │              │                     │
└─────────────────────┘              │  GET /api/projects  │
                                     │  GET /api/todos     │
┌─────────────────────┐              │  GET /api/deadlines │
│  Google Calendar    │──── API ────▶│  POST /api/capture  │
│  (OAuth2)           │              │  POST /api/ai/sum   │
└─────────────────────┘              └────────┬────────────┘
                                              │
                                              ▼
                                     ┌─────────────────────┐
                                     │  React Frontend     │
                                     │  localhost:5173      │
                                     │                     │
                                     │  Dashboard UI       │
                                     └─────────────────────┘
```

---

## API Endpoints

### `GET /api/projects`
Returns array of project objects scanned from `~/_Projects/`.
```json
[
  {
    "name": "TutorOS",
    "path": "C:/Users/Adi/_Projects/TutorOS",
    "stateFile": "agent_state.md",
    "status": "in_progress",
    "lastModified": "2026-04-03T18:22:00Z",
    "summary": "Next.js 14 + Supabase SaaS for tutoring. Currently building student CRM and AI lesson plan generation.",
    "nextSteps": ["Implement Fabric.js whiteboard", "Connect Google Calendar API", "Build post-session debrief flow"],
    "staleDays": 2
  }
]
```

### `GET /api/todos`
Returns all extracted TODOs grouped by project.
```json
{
  "total": 47,
  "completed": 12,
  "byProject": {
    "TutorOS": [
      { "text": "Add KaTeX rendering to quiz component", "file": "agent_state.md", "line": 34, "done": false }
    ]
  }
}
```

### `GET /api/deadlines`
Returns merged deadlines from manual file + Google Calendar.

### `POST /api/capture`
Body: `{ "text": "string" }` — appends to inbox.md.

### `POST /api/ai/summarize`
Body: `{ "projectName": "string" }` — returns Claude API summary of state file.

---

## File Conventions

### State File Detection (priority order)
The scanner looks for these files in each project folder:
1. `agent_state.md`
2. `Agent_State.json` (parse JSON, extract relevant fields)
3. `state.md`
4. `Status.md`
5. `README.md` (fallback)

### Status Inference
If no `status:` frontmatter exists, infer from content:
- Contains "blocked" or "waiting on" → `blocked`
- Contains "completed" or "shipped" or "done" → `completed`
- Contains "not started" or "idea" or "concept" → `not_started`
- Has been modified in last 14 days → `in_progress`
- Not modified in 14+ days → `stale`

### Deadline File Format
```markdown
- [ ] YYYY-MM-DD | Description | optional-tag
- [x] YYYY-MM-DD | Description | optional-tag
```
Tags can be: `school`, `project`, `personal`, `tutoring`, `poker`

---

## UI Layout

```
┌──────────────────────────────────────────────────────────┐
│  ┌─ Quick Capture ────────────────────────────────────┐  │
│  │  [ Type a thought, TODO, or idea... ]    [Enter]   │  │
│  └────────────────────────────────────────────────────┘  │
│                                                          │
│  ┌─ Deadlines ────────────────────┐  ┌─ Stats ────────┐ │
│  │  🔴 Lab 8 due          Apr 10  │  │ 6 active proj  │ │
│  │  🟡 HW 9               Apr 15  │  │ 47 open TODOs  │ │
│  │  🟢 TutorOS demo       Apr 20  │  │ 3 stale (>14d) │ │
│  │  ✅ Midterm 3           Apr 01  │  │ 12 done today  │ │
│  └────────────────────────────────┘  └────────────────┘  │
│                                                          │
│  ┌─ Projects ────────────────────────────────────────┐   │
│  │ ┌──────────┐ ┌──────────┐ ┌──────────┐           │   │
│  │ │ TutorOS  │ │NeuralGTO │ │ HoopIQ   │  ...      │   │
│  │ │ ●active  │ │ ●stale   │ │ ●idea    │           │   │
│  │ │ 2d ago   │ │ 18d ago  │ │ 31d ago  │           │   │
│  │ │ Building │ │ CFR eng  │ │ PRD done │           │   │
│  │ │ CRM...   │ │ paused   │ │ not star │           │   │
│  │ │[VS Code] │ │[VS Code] │ │[VS Code] │           │   │
│  │ │[Summary] │ │[Summary] │ │[Summary] │           │   │
│  │ └──────────┘ └──────────┘ └──────────┘           │   │
│  └───────────────────────────────────────────────────┘   │
│                                                          │
│  ┌─ All TODOs ───────────────────────────────────────┐   │
│  │  □ Add KaTeX rendering (TutorOS)                  │   │
│  │  □ Fix ADC calibration (ECE319H)                  │   │
│  │  □ Write counterexample drill set (M325K)         │   │
│  │  ...                                              │   │
│  └───────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────┘
```

---

## Setup Instructions (for the developer agent)

1. `mkdir ~/SecondBrain && cd ~/SecondBrain`
2. Initialize Obsidian vault structure (Inbox/, Projects/, Areas/, Resources/, Archive/, ChatExports/, Deadlines/, DailyNotes/)
3. Create symlinks from `~/SecondBrain/Projects/*` → `~/_Projects/*` (use `mklink /D` on Windows)
4. Scaffold the dashboard app in `~/SecondBrain/_dashboard/`
5. `pnpm create vite . --template react-ts`
6. Add Express backend in `server/`
7. Implement scanner, TODO extractor, deadline reader
8. Build the UI components
9. Add `"dev"` script that runs both Vite and Express concurrently
10. Create `~/SecondBrain/Deadlines/deadlines.md` with initial template
11. Create `~/SecondBrain/Inbox/inbox.md`

### Environment Variables (`.env`)
```
PROJECTS_DIR=C:\Users\Adi\_Projects
VAULT_DIR=C:\Users\Adi\SecondBrain
GOOGLE_CLIENT_ID=           # optional, for calendar
GOOGLE_CLIENT_SECRET=       # optional, for calendar
ANTHROPIC_API_KEY=          # optional, for AI features
PORT=3001
```

---

## Success Criteria

- [ ] Open `localhost:5173`, see all projects from `~/_Projects/` with status and last-modified
- [ ] See aggregated TODOs from all markdown files across all projects
- [ ] See upcoming deadlines from `deadlines.md`, color-coded by urgency
- [ ] Quick capture input appends to inbox.md with timestamp
- [ ] Clicking "Open in VS Code" opens the project folder
- [ ] Stale projects (>14 days untouched) are visually flagged
- [ ] Page loads in <2 seconds (filesystem scan should be fast for <50 projects)
- [ ] Works fully offline (except Google Calendar and Claude API features)

---

## Non-Goals (explicitly out of scope)

- No mobile app
- No authentication or multi-user
- No database — everything reads from filesystem
- No real-time sync — refresh to update (or add a 60-second polling interval)
- No deployment — localhost only
- No Electron wrapper — just a browser tab
- No modification of existing project files (except TODO checkbox toggling and inbox appending)
