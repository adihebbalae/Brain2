import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { promises as fs } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { getDatasetMirrorDir } from './data-dir.js'
import { normalizeImportDatasets, scanImportDatasets } from './wiki-imports.js'

describe('wiki-imports normalization', () => {
  let tempRoot: string
  let dataDir: string
  let vaultDir: string
  let originalEnv: NodeJS.ProcessEnv

  beforeEach(async () => {
    tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'wiki-imports-'))
    dataDir = path.join(tempRoot, 'data')
    vaultDir = path.join(tempRoot, 'vault')
    originalEnv = { ...process.env }

    await fs.mkdir(dataDir, { recursive: true })
    await fs.mkdir(vaultDir, { recursive: true })

    process.env.DATA_DIR = dataDir
    process.env.VAULT_DIR = vaultDir
    delete process.env.VAULT_DIRS
  })

  afterEach(async () => {
    process.env = originalEnv
    await fs.rm(tempRoot, { recursive: true, force: true })
  })

  it('normalizes Claude conversations with structured message payloads', async () => {
    const datasetId = 'claude:data-claude-sample'
    const datasetDir = path.join(dataDir, 'data-claude-sample')
    await fs.mkdir(datasetDir, { recursive: true })
    await fs.writeFile(
      path.join(datasetDir, 'conversations.json'),
      JSON.stringify([
        {
          uuid: 'conv-1',
          name: 'Structured Conversation',
          chat_messages: [
            {
              sender: 'assistant',
              content: [{ text: 'Hello from Claude' }],
              created_at: '2026-04-24T10:00:00.000Z',
            },
            {
              sender: 'user',
              text: { value: 'Nested user reply' },
              created_at: '2026-04-24T10:01:00.000Z',
            },
          ],
        },
      ], null, 2),
      'utf-8',
    )

    await scanImportDatasets()
    const { results } = await normalizeImportDatasets([datasetId])

    expect(results).toHaveLength(1)
    expect(results[0].counts.conversations).toBe(1)

    const markdown = await fs.readFile(
      path.join(getDatasetMirrorDir(datasetId), 'conversations', 'conv-1.md'),
      'utf-8',
    )
    expect(markdown).toContain('Hello from Claude')
    expect(markdown).toContain('Nested user reply')
  })

  it('normalizes calendar ICS exports with the installed node-ical package shape', async () => {
    const datasetId = 'takeout:takeout-sample:calendar'
    const calendarDir = path.join(dataDir, 'takeout-sample', 'Takeout', 'Calendar')
    await fs.mkdir(calendarDir, { recursive: true })
    await fs.writeFile(
      path.join(calendarDir, 'primary.ics'),
      [
        'BEGIN:VCALENDAR',
        'VERSION:2.0',
        'BEGIN:VEVENT',
        'UID:event-1',
        'DTSTAMP:20260424T120000Z',
        'DTSTART:20260425T130000Z',
        'DTEND:20260425T140000Z',
        'SUMMARY:Project Sync',
        'LOCATION:Office',
        'END:VEVENT',
        'END:VCALENDAR',
        '',
      ].join('\r\n'),
      'utf-8',
    )

    await scanImportDatasets()
    const { results } = await normalizeImportDatasets([datasetId])

    expect(results).toHaveLength(1)
    expect(results[0].counts.events).toBe(1)

    const rollups = await fs.readFile(path.join(getDatasetMirrorDir(datasetId), 'rollups.md'), 'utf-8')
    expect(rollups).toContain('Calendar Rollups')
    expect(rollups).toContain('Total events: 1')
  })
})
