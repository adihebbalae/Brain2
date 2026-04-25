import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import path from 'node:path'
import os from 'node:os'
import { promises as fs } from 'node:fs'
import { getYouTubeHistoryData, parseYouTubeHistory } from './youtube-history-parser.js'

describe('YouTube history parser - Takeout HTML', () => {
  let tempDir: string
  let originalDataDir: string | undefined

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'youtube-html-history-'))
    originalDataDir = process.env.DATA_DIR
    process.env.DATA_DIR = tempDir
  })

  afterEach(async () => {
    if (originalDataDir === undefined) {
      delete process.env.DATA_DIR
    } else {
      process.env.DATA_DIR = originalDataDir
    }

    await fs.rm(tempDir, { recursive: true, force: true })
  })

  it('parses a direct watch-history.html file', async () => {
    const filePath = path.join(tempDir, 'watch-history.html')
    await fs.writeFile(filePath, sampleWatchHistoryHtml(), 'utf-8')

    const entries = await parseYouTubeHistory(filePath)
    expect(entries).toHaveLength(1)
    expect(entries[0]).toMatchObject({
      title: 'Build Better Notes',
      channel: 'Brain Lab',
      url: 'https://www.youtube.com/watch?v=brain123',
    })
  })

  it('auto-detects watch-history.html under DATA_DIR', async () => {
    const historyDir = path.join(
      tempDir,
      'takeout-export',
      'Takeout',
      'YouTube and YouTube Music',
      'history',
    )
    await fs.mkdir(historyDir, { recursive: true })
    await fs.writeFile(path.join(historyDir, 'watch-history.html'), sampleWatchHistoryHtml(), 'utf-8')

    const result = await getYouTubeHistoryData()
    expect(result.available).toBe(true)
    expect(result.total).toBe(1)
    expect(result.last30Days[0].title).toBe('Build Better Notes')
  })
})

function sampleWatchHistoryHtml(): string {
  return `
    <!doctype html>
    <html>
      <body>
        <div class="outer-cell">
          <div class="content-cell mdl-cell--6-col">
            Watched <a href="https://www.youtube.com/watch?v=brain123">Build Better Notes</a><br />
            <a href="https://www.youtube.com/channel/brainlab">Brain Lab</a><br />
            Apr 22, 2026, 9:30:00 PM UTC
          </div>
          <div class="mdl-typography--caption">YouTube</div>
        </div>
      </body>
    </html>
  `
}
