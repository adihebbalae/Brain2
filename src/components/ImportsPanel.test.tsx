import { describe, it, expect, vi, beforeEach } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { ImportsPanel } from './ImportsPanel'
import * as wikiImportsHook from '../hooks/useWikiImports'

vi.mock('../hooks/useWikiImports')

describe('ImportsPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders empty state when no datasets are discovered', () => {
    vi.mocked(wikiImportsHook.useWikiImports).mockReturnValue({
      datasets: [],
      activeJobs: [],
      lastScannedAt: null,
      lastJob: null,
      loading: false,
      error: null,
      scan: vi.fn(),
      normalize: vi.fn(),
      ingest: vi.fn(),
      refetch: vi.fn(),
    })

    render(<ImportsPanel />)

    expect(screen.getByText('No import datasets discovered yet.')).toBeTruthy()
    expect(screen.getByRole('button', { name: /scan data directory/i })).toBeTruthy()
  })

  it('renders dataset cards and warnings', () => {
    vi.mocked(wikiImportsHook.useWikiImports).mockReturnValue({
      datasets: [
        {
          id: 'takeout:sample:youtube',
          kind: 'youtube',
          title: 'YouTube Export sample',
          sourceRoot: 'C:/data/sample',
          sourcePaths: ['C:/data/sample'],
          sizeBytes: 4096,
          fileCount: 5,
          warnings: ['No search history found'],
          catalogOnly: false,
          counts: { watchEvents: 20, searchEvents: 0 },
          lastScannedAt: '2026-04-24T12:00:00.000Z',
          normalized: true,
          ingested: false,
          lastNormalizedAt: '2026-04-24T12:05:00.000Z',
        },
      ],
      activeJobs: [],
      lastScannedAt: '2026-04-24T12:00:00.000Z',
      lastJob: null,
      loading: false,
      error: null,
      scan: vi.fn(),
      normalize: vi.fn(),
      ingest: vi.fn(),
      refetch: vi.fn(),
    })

    render(<ImportsPanel />)

    expect(screen.getByText('YouTube Export sample')).toBeTruthy()
    expect(screen.getByText('watchEvents: 20')).toBeTruthy()
    expect(screen.getByText('No search history found')).toBeTruthy()
    expect(screen.getByText('Mirrored')).toBeTruthy()
  })

  it('queues ingest for selected datasets', async () => {
    const ingest = vi.fn().mockResolvedValue('job-1')

    vi.mocked(wikiImportsHook.useWikiImports).mockReturnValue({
      datasets: [
        {
          id: 'claude:data-1',
          kind: 'claude',
          title: 'Claude Export data-1',
          sourceRoot: 'C:/data/data-1',
          sourcePaths: ['C:/data/data-1/conversations.json'],
          sizeBytes: 1024,
          fileCount: 2,
          warnings: [],
          catalogOnly: false,
          counts: { conversations: 4 },
          lastScannedAt: '2026-04-24T12:00:00.000Z',
          normalized: false,
          ingested: false,
        },
      ],
      activeJobs: [],
      lastScannedAt: '2026-04-24T12:00:00.000Z',
      lastJob: null,
      loading: false,
      error: null,
      scan: vi.fn(),
      normalize: vi.fn(),
      ingest,
      refetch: vi.fn(),
    })

    render(<ImportsPanel />)

    const checkbox = screen.getAllByRole('checkbox')[1]
    fireEvent.click(checkbox)

    const addButton = screen.getByRole('button', { name: /add to wiki/i })
    expect(addButton).toBeTruthy()
    fireEvent.click(addButton)

    await waitFor(() => {
      expect(ingest).toHaveBeenCalledWith(['claude:data-1'], 'default')
    })
  })

  it('shows active job progress', () => {
    vi.mocked(wikiImportsHook.useWikiImports).mockReturnValue({
      datasets: [],
      activeJobs: [
        {
          id: 'job-2',
          type: 'normalize',
          status: 'running',
          createdAt: '2026-04-24T12:00:00.000Z',
          updatedAt: '2026-04-24T12:01:00.000Z',
          progress: {
            phase: 'normalizing',
            total: 4,
            completed: 2,
            current: 'Claude Export',
            errors: 1,
          },
          logs: ['started', 'processing'],
        },
      ],
      lastScannedAt: null,
      lastJob: null,
      loading: false,
      error: null,
      scan: vi.fn(),
      normalize: vi.fn(),
      ingest: vi.fn(),
      refetch: vi.fn(),
    })

    render(<ImportsPanel />)

    expect(screen.getByText(/normalize job/i)).toBeTruthy()
    expect(screen.getByText(/2\/4 processed/i)).toBeTruthy()
    expect(screen.getByText(/Current: Claude Export/i)).toBeTruthy()
  })

  it('shows dataset-level failures for completed jobs', () => {
    vi.mocked(wikiImportsHook.useWikiImports).mockReturnValue({
      datasets: [],
      activeJobs: [],
      lastScannedAt: null,
      lastJob: {
        id: 'job-3',
        type: 'normalize',
        status: 'completed',
        createdAt: '2026-04-24T12:00:00.000Z',
        updatedAt: '2026-04-24T12:02:00.000Z',
        progress: {
          phase: 'completed',
          total: 2,
          completed: 2,
          errors: 1,
        },
        logs: ['completed with issues'],
        error: '1 dataset(s) failed to normalize; 1 succeeded',
        result: {
          failures: [
            {
              datasetId: 'claude:data-1',
              error: 'value.replace is not a function',
            },
          ],
        },
      },
      loading: false,
      error: null,
      scan: vi.fn(),
      normalize: vi.fn(),
      ingest: vi.fn(),
      refetch: vi.fn(),
    })

    render(<ImportsPanel />)

    expect(screen.getByText(/1 dataset\(s\) failed to normalize/i)).toBeTruthy()
    expect(screen.getByText(/claude:data-1: value\.replace is not a function/i)).toBeTruthy()
  })
})
