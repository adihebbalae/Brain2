╔══════════════════════════════════════════════════════════════╗
║  🔀 SWITCH TO:  @engineer   |   MODEL:  Sonnet             ║
╚══════════════════════════════════════════════════════════════╝

# Handoff: YouTube Watch History (Google Takeout)
**From**: Manager → **To**: Engineer | **Model**: claude-sonnet-4-5
**Date**: 2026-04-16 | **Task ID**: TASK-021

## Context
Cortex is a local-only personal command center running on localhost. Backend: Express.js TypeScript on `:3001`. Frontend: React + Vite + TypeScript + Tailwind CSS on `:5173`. No database — all data read from local files.

WHY this matters: YouTube watch history reveals what the user is actually learning and consuming. Surfacing it in the dashboard closes the loop between "what I'm studying" and "what's on my project list." It feeds the weekly review (TASK-025).

The user does NOT yet have their YouTube Takeout export — part of this task is writing the setup guide so they know how to get it. The parser must gracefully handle absence of the file.

**Package manager**: npm (NOT pnpm)
**Test framework**: Vitest

## Task

### 1. Google Takeout parser (`server/lib/youtube-history-parser.ts`)
Google Takeout `watch-history.json` is a JSON array. Each entry looks like:
```json
{
  "header": "YouTube",
  "title": "Watched Video Title Here",
  "titleUrl": "https://www.youtube.com/watch?v=xxx",
  "subtitles": [{"name": "Channel Name", "url": "https://www.youtube.com/channel/..."}],
  "time": "2026-03-15T14:23:45.000Z",
  "products": ["YouTube"],
  "activityControls": ["YouTube watch history"]
}
```

Parser should:
- Read the JSON array from `YOUTUBE_HISTORY_PATH` (env var, no default — just return empty if not set)
- Extract: `title` (strip "Watched " prefix), `titleUrl`, `channel` (from `subtitles[0].name`), `watchedAt` (parse `time` field)
- Filter out non-watch entries (some entries have title starting with "Searched for")
- Group by month: `{ month: "2026-03", videos: [...] }`
- Also compute: top 5 channels by watch count over last 30 days
- Deduplicate by titleUrl (keep most recent watch date if duplicate)
- Export: `parseYouTubeHistory(filePath: string)` and `getYouTubeStats(history)` functions

### 2. Route (`server/routes/media.ts`)
`GET /api/youtube-history` — returns:
```typescript
{
  available: boolean,
  total: number,
  last30Days: YouTubeEntry[],  // most recent first, max 50
  byMonth: { month: string, count: number, topChannels: string[] }[],
  topChannels: { name: string, count: number }[]
}
```
If `YOUTUBE_HISTORY_PATH` not set or file not found: return `{ available: false, total: 0, last30Days: [], byMonth: [], topChannels: [] }`

### 3. Frontend `MediaPanel` component (`src/components/MediaPanel.tsx`)
- If `available: false`: show placeholder card "No YouTube history yet — click to see setup guide" linking to a modal with the setup steps
- If available: show two sections:
  - **Recent watches** (last 7 days, compact list with channel + title + date)
  - **Top channels** this month (bar-style list: channel name + count as gray bar)
- Keep component compact (same visual weight as other dashboard panels)

### 4. Setup guide
Write `VAULT_DIR/Resources/YouTube-Takeout-Setup.md` with these exact steps:
1. Go to [takeout.google.com](https://takeout.google.com)
2. Click "Deselect all"
3. Scroll to "YouTube and YouTube Music" and check it
4. Click "All YouTube data included" → deselect all → select "history" only
5. Click "Next step" → "Export once" → "JSON format" → "Create export"
6. Wait for email → download zip → extract `watch-history.json`
7. Copy `watch-history.json` to the path in your `.env` as `YOUTUBE_HISTORY_PATH`

### 5. New `.env` var
Add to `.env.example`: `YOUTUBE_HISTORY_PATH=` (empty default, path to Takeout watch-history.json)

## Acceptance Criteria
- [ ] `parseYouTubeHistory()` correctly parses the Takeout JSON format
- [ ] "Searched for" entries are filtered out
- [ ] `GET /api/youtube-history` returns correct shape
- [ ] Graceful empty state when file missing
- [ ] `MediaPanel` renders with recent/top-channels sections
- [ ] Setup guide written to `VAULT_DIR/Resources/YouTube-Takeout-Setup.md`
- [ ] `.env.example` has `YOUTUBE_HISTORY_PATH` entry
- [ ] Tests for parser (use a fixture JSON with 5+ sample entries)
- [ ] All existing tests still pass

## Validation Gates
- [ ] `npm test` — all tests pass
- [ ] `npm run build` — no TypeScript errors
- [ ] `GET /api/youtube-history` with no env var returns `{ available: false }`

## Files to Read First
- `server/routes/ai.ts` or `server/routes/chats.ts` — see route registration pattern
- `server/lib/chat-export-parser.ts` — see how file parsers are structured
- `src/App.tsx` — see how to add new panel import
- `.env.example` — format for new env var

## Constraints
- No YouTube Data API v3 — local file parse ONLY
- Do NOT attempt to download history programmatically
- Subtitles array may be empty for some entries — handle gracefully
- File could be very large (10k+ entries) — parse efficiently, don't load full file into memory multiple times
