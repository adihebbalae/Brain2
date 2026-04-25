import { describe, expect, it } from 'vitest'
import {
  parseChromeBookmarksHtml,
  parseYouTubeSearchHistoryHtml,
  parseYouTubeWatchHistoryHtml,
} from './wiki-import-parsers.js'

describe('wiki import parsers', () => {
  it('parses Chrome bookmark exports from HTML', () => {
    const html = `
      <!doctype html>
      <html>
        <body>
          <dl>
            <dt><a href="https://example.com" add_date="1713000000">Example</a></dt>
            <dt><a href="https://openai.com">OpenAI</a></dt>
          </dl>
        </body>
      </html>
    `

    const bookmarks = parseChromeBookmarksHtml(html)
    expect(bookmarks).toEqual([
      {
        title: 'Example',
        url: 'https://example.com',
        addDate: '1713000000',
        lastModified: undefined,
      },
      {
        title: 'OpenAI',
        url: 'https://openai.com',
        addDate: undefined,
        lastModified: undefined,
      },
    ])
  })

  it('parses YouTube watch history HTML exports', () => {
    const html = `
      <!doctype html>
      <html>
        <body>
          <div class="outer-cell">
            <div class="content-cell mdl-cell--6-col">
              Watched <a href="https://www.youtube.com/watch?v=abc123">A Useful Video</a><br />
              <a href="https://www.youtube.com/channel/channel-1">Helpful Channel</a><br />
              Apr 20, 2026, 3:40:00 PM UTC
            </div>
            <div class="mdl-typography--caption">YouTube</div>
          </div>
        </body>
      </html>
    `

    const entries = parseYouTubeWatchHistoryHtml(html)
    expect(entries).toHaveLength(1)
    expect(entries[0]).toMatchObject({
      action: 'Watched',
      title: 'A Useful Video',
      url: 'https://www.youtube.com/watch?v=abc123',
      channel: 'Helpful Channel',
      isAd: false,
    })
    expect(entries[0].watchedAt).toBe('2026-04-20T15:40:00.000Z')
  })

  it('parses YouTube search history HTML exports', () => {
    const html = `
      <!doctype html>
      <html>
        <body>
          <div class="outer-cell">
            <div class="content-cell mdl-cell--6-col">
              Searched for <a href="https://www.youtube.com/results?search_query=typescript">TypeScript tutorial</a><br />
              Apr 19, 2026, 8:15:00 AM UTC
            </div>
          </div>
        </body>
      </html>
    `

    const entries = parseYouTubeSearchHistoryHtml(html)
    expect(entries).toEqual([
      {
        query: 'TypeScript tutorial',
        url: 'https://www.youtube.com/results?search_query=typescript',
        searchedAt: '2026-04-19T08:15:00.000Z',
      },
    ])
  })
})
