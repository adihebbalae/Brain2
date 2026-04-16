import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { WikiPanel } from './WikiPanel'
import * as useWikiHook from '../hooks/useWiki'

// Mock the useWiki hook
vi.mock('../hooks/useWiki')

describe('WikiPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should render empty state when wiki does not exist', () => {
    vi.mocked(useWikiHook.useWiki).mockReturnValue({
      wikiExists: false,
      pages: [],
      loading: false,
      error: null,
      gaps: null,
      gapsLoading: false,
      query: vi.fn(),
      lint: vi.fn(),
      ingest: vi.fn(),
      analyzeGaps: vi.fn(),
      refetch: vi.fn(),
    })

    render(<WikiPanel />)

    expect(screen.getByText('No wiki yet — ingest a file to start')).toBeTruthy()
    expect(screen.getByPlaceholderText('Source file path...')).toBeTruthy()
    expect(screen.getByRole('button', { name: /ingest/i })).toBeTruthy()
  })

  it('should render page list when wiki exists', () => {
    vi.mocked(useWikiHook.useWiki).mockReturnValue({
      wikiExists: true,
      pages: [
        {
          name: 'React',
          title: 'React Library',
          status: 'developing',
          sources: ['source1.md'],
          lastUpdated: '2026-04-01',
          summary: 'JavaScript library for UI',
        },
        {
          name: 'TypeScript',
          title: 'TypeScript',
          status: 'seedling',
          sources: ['source2.md'],
          lastUpdated: '2026-04-02',
          summary: 'Typed JavaScript',
        },
      ],
      loading: false,
      error: null,
      gaps: null,
      gapsLoading: false,
      query: vi.fn(),
      lint: vi.fn(),
      ingest: vi.fn(),
      analyzeGaps: vi.fn(),
      refetch: vi.fn(),
    })

    render(<WikiPanel />)

    expect(screen.getByText('Pages (2)')).toBeTruthy()
    expect(screen.getByText('React')).toBeTruthy()
    expect(screen.getByText(/JavaScript library for UI/)).toBeTruthy()
    expect(screen.getByText('TypeScript')).toBeTruthy()
    expect(screen.getByText(/Typed JavaScript/)).toBeTruthy()
  })

  it('should show correct health badge color for high score', async () => {
    const mockLint = vi.fn().mockResolvedValue({
      orphans: [],
      stale: [],
      gaps: [],
      healthScore: 90,
      wikiExists: true,
    })

    vi.mocked(useWikiHook.useWiki).mockReturnValue({
      wikiExists: true,
      pages: [],
      loading: false,
      error: null,
      gaps: null,
      gapsLoading: false,
      query: vi.fn(),
      lint: mockLint,
      ingest: vi.fn(),
      analyzeGaps: vi.fn(),
      refetch: vi.fn(),
    })

    render(<WikiPanel />)

    // Click lint button
    const lintButton = screen.getByRole('button', { name: /lint/i })
    fireEvent.click(lintButton)

    await waitFor(() => {
      const badge = screen.getByText('Health: 90')
      expect(badge.className).toContain('bg-green-100')
      expect(badge.className).toContain('text-green-800')
    })
  })

  it('should show correct health badge color for medium score', async () => {
    const mockLint = vi.fn().mockResolvedValue({
      orphans: ['Page1'],
      stale: [],
      gaps: [],
      healthScore: 60,
      wikiExists: true,
    })

    vi.mocked(useWikiHook.useWiki).mockReturnValue({
      wikiExists: true,
      pages: [],
      loading: false,
      error: null,
      gaps: null,
      gapsLoading: false,
      query: vi.fn(),
      lint: mockLint,
      ingest: vi.fn(),
      analyzeGaps: vi.fn(),
      refetch: vi.fn(),
    })

    render(<WikiPanel />)

    const lintButton = screen.getByRole('button', { name: /lint/i })
    fireEvent.click(lintButton)

    await waitFor(() => {
      const badge = screen.getByText('Health: 60')
      expect(badge.className).toContain('bg-yellow-100')
      expect(badge.className).toContain('text-yellow-800')
    })
  })

  it('should show correct health badge color for low score', async () => {
    const mockLint = vi.fn().mockResolvedValue({
      orphans: ['Page1', 'Page2'],
      stale: ['Page3'],
      gaps: ['Missing1', 'Missing2'],
      healthScore: 40,
      wikiExists: true,
    })

    vi.mocked(useWikiHook.useWiki).mockReturnValue({
      wikiExists: true,
      pages: [],
      loading: false,
      error: null,
      gaps: null,
      gapsLoading: false,
      query: vi.fn(),
      lint: mockLint,
      ingest: vi.fn(),
      analyzeGaps: vi.fn(),
      refetch: vi.fn(),
    })

    render(<WikiPanel />)

    const lintButton = screen.getByRole('button', { name: /lint/i })
    fireEvent.click(lintButton)

    await waitFor(() => {
      const badge = screen.getByText('Health: 40')
      expect(badge.className).toContain('bg-red-100')
      expect(badge.className).toContain('text-red-800')
    })
  })

  it('should submit query on Enter key', async () => {
    const mockQuery = vi.fn().mockResolvedValue({
      answer: 'React is a JavaScript library.',
      citations: ['React'],
    })

    vi.mocked(useWikiHook.useWiki).mockReturnValue({
      wikiExists: true,
      pages: [],
      loading: false,
      error: null,
      gaps: null,
      gapsLoading: false,
      query: mockQuery,
      lint: vi.fn(),
      ingest: vi.fn(),
      analyzeGaps: vi.fn(),
      refetch: vi.fn(),
    })

    render(<WikiPanel />)

    const input = screen.getByPlaceholderText('Ask a question...')
    fireEvent.change(input, { target: { value: 'What is React?' } })
    fireEvent.submit(input.closest('form')!)

    await waitFor(() => {
      expect(mockQuery).toHaveBeenCalledWith('What is React?')
    })
  })

  it('should display query result with citations', async () => {
    const mockQuery = vi.fn().mockResolvedValue({
      answer: 'React is a JavaScript library for building user interfaces.',
      citations: ['React', 'TypeScript'],
    })

    vi.mocked(useWikiHook.useWiki).mockReturnValue({
      wikiExists: true,
      pages: [],
      loading: false,
      error: null,
      gaps: null,
      gapsLoading: false,
      query: mockQuery,
      lint: vi.fn(),
      ingest: vi.fn(),
      analyzeGaps: vi.fn(),
      refetch: vi.fn(),
    })

    render(<WikiPanel />)

    const input = screen.getByPlaceholderText('Ask a question...')
    const askButton = screen.getByRole('button', { name: /ask/i })

    fireEvent.change(input, { target: { value: 'What is React?' } })
    fireEvent.click(askButton)

    await waitFor(() => {
      expect(screen.getByText(/React is a JavaScript library/)).toBeTruthy()
      expect(screen.getByText('[[React]]')).toBeTruthy()
      expect(screen.getByText('[[TypeScript]]')).toBeTruthy()
    })
  })

  it('should show success toast after ingest', async () => {
    const mockIngest = vi.fn().mockResolvedValue({
      pagesCreated: ['Page1', 'Page2'],
      pagesUpdated: ['Page3'],
      error: undefined,
    })

    vi.mocked(useWikiHook.useWiki).mockReturnValue({
      wikiExists: true,
      pages: [],
      loading: false,
      error: null,
      gaps: null,
      gapsLoading: false,
      query: vi.fn(),
      lint: vi.fn(),
      ingest: mockIngest,
      analyzeGaps: vi.fn(),
      refetch: vi.fn(),
    })

    render(<WikiPanel />)

    const pathInput = screen.getByPlaceholderText('File path...')
    const ingestButton = screen.getByRole('button', { name: /^ingest$/i })

    fireEvent.change(pathInput, { target: { value: '/path/to/source.md' } })
    fireEvent.click(ingestButton)

    await waitFor(() => {
      expect(mockIngest).toHaveBeenCalledWith('/path/to/source.md')
      expect(screen.getByText(/Created 2 pages, updated 1 pages/)).toBeTruthy()
    })
  })

  it('should show error message on ingest failure', async () => {
    const mockIngest = vi.fn().mockResolvedValue({
      pagesCreated: [],
      pagesUpdated: [],
      error: 'Source file not found',
    })

    vi.mocked(useWikiHook.useWiki).mockReturnValue({
      wikiExists: true,
      pages: [],
      loading: false,
      error: null,
      gaps: null,
      gapsLoading: false,
      query: vi.fn(),
      lint: vi.fn(),
      ingest: mockIngest,
      analyzeGaps: vi.fn(),
      refetch: vi.fn(),
    })

    render(<WikiPanel />)

    const pathInput = screen.getByPlaceholderText('File path...')
    const ingestButton = screen.getByRole('button', { name: /^ingest$/i })

    fireEvent.change(pathInput, { target: { value: '/invalid/path.md' } })
    fireEvent.click(ingestButton)

    await waitFor(() => {
      expect(screen.getByText(/Source file not found/)).toBeTruthy()
    })
  })

  it('should show empty state for gaps before analysis', () => {
    vi.mocked(useWikiHook.useWiki).mockReturnValue({
      wikiExists: true,
      pages: [],
      loading: false,
      error: null,
      gaps: null,
      gapsLoading: false,
      query: vi.fn(),
      lint: vi.fn(),
      ingest: vi.fn(),
      analyzeGaps: vi.fn(),
      refetch: vi.fn(),
    })

    render(<WikiPanel />)

    expect(screen.getByText('📚 Learning Gaps')).toBeTruthy()
    expect(screen.getByText('Click Analyze to find gaps')).toBeTruthy()
    expect(screen.getByRole('button', { name: /^analyze$/i })).toBeTruthy()
  })

  it('should render gaps with resources after analysis', () => {
    vi.mocked(useWikiHook.useWiki).mockReturnValue({
      wikiExists: true,
      pages: [],
      loading: false,
      error: null,
      gaps: [
        {
          topic: 'React Hooks',
          reason: 'Referenced 4x in active projects but no wiki page',
          priority: 1,
          resources: [
            {
              title: 'React Hooks Documentation',
              url: 'https://react.dev/reference/react',
              type: 'article' as const,
            },
            {
              title: 'React Hooks Tutorial',
              url: 'https://youtube.com/watch?v=abc123',
              type: 'video' as const,
            },
          ],
        },
        {
          topic: 'TypeScript',
          reason: 'Referenced 2x in active projects but no wiki page',
          priority: 2,
          resources: [],
        },
      ],
      gapsLoading: false,
      query: vi.fn(),
      lint: vi.fn(),
      ingest: vi.fn(),
      analyzeGaps: vi.fn(),
      refetch: vi.fn(),
    })

    render(<WikiPanel />)

    // Check gap 1
    expect(screen.getByText('React Hooks')).toBeTruthy()
    expect(screen.getByText('Referenced 4x in active projects but no wiki page')).toBeTruthy()
    expect(screen.getByText('Priority 1')).toBeTruthy()
    expect(screen.getByText(/React Hooks Documentation/)).toBeTruthy()
    expect(screen.getByText(/React Hooks Tutorial/)).toBeTruthy()

    // Check gap 2
    expect(screen.getByText('TypeScript')).toBeTruthy()
    expect(screen.getByText('Referenced 2x in active projects but no wiki page')).toBeTruthy()
    expect(screen.getByText('Priority 2')).toBeTruthy()

    // Check for Add to Inbox buttons (one per gap)
    const addButtons = screen.getAllByRole('button', { name: /add to inbox/i })
    expect(addButtons).toHaveLength(2)
  })

  it('should call analyzeGaps when Analyze button is clicked', async () => {
    const mockAnalyzeGaps = vi.fn().mockResolvedValue({
      gaps: [],
      generatedAt: new Date().toISOString(),
    })

    vi.mocked(useWikiHook.useWiki).mockReturnValue({
      wikiExists: true,
      pages: [],
      loading: false,
      error: null,
      gaps: null,
      gapsLoading: false,
      query: vi.fn(),
      lint: vi.fn(),
      ingest: vi.fn(),
      analyzeGaps: mockAnalyzeGaps,
      refetch: vi.fn(),
    })

    render(<WikiPanel />)

    const analyzeButton = screen.getByRole('button', { name: /^analyze$/i })
    fireEvent.click(analyzeButton)

    await waitFor(() => {
      expect(mockAnalyzeGaps).toHaveBeenCalled()
    })
  })

  it('should call POST /api/capture when Add to Inbox is clicked', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({}),
    })
    global.fetch = mockFetch

    vi.mocked(useWikiHook.useWiki).mockReturnValue({
      wikiExists: true,
      pages: [],
      loading: false,
      error: null,
      gaps: [
        {
          topic: 'React Hooks',
          reason: 'Referenced 4x in active projects but no wiki page',
          priority: 1,
          resources: [],
        },
      ],
      gapsLoading: false,
      query: vi.fn(),
      lint: vi.fn(),
      ingest: vi.fn(),
      analyzeGaps: vi.fn(),
      refetch: vi.fn(),
    })

    render(<WikiPanel />)

    const addButton = screen.getByRole('button', { name: /add to inbox/i })
    fireEvent.click(addButton)

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:3001/api/capture',
        expect.objectContaining({
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ text: 'Learn: React Hooks' }),
        })
      )
    })
  })

  it('should show loading message while analyzing gaps', () => {
    vi.mocked(useWikiHook.useWiki).mockReturnValue({
      wikiExists: true,
      pages: [],
      loading: false,
      error: null,
      gaps: null,
      gapsLoading: true,
      query: vi.fn(),
      lint: vi.fn(),
      ingest: vi.fn(),
      analyzeGaps: vi.fn(),
      refetch: vi.fn(),
    })

    render(<WikiPanel />)

    expect(screen.getByText('Analyzing...')).toBeTruthy()
    expect(screen.getByText('Analyzing... (this may take a moment)')).toBeTruthy()
  })

  it('should show empty result message when no gaps found', () => {
    vi.mocked(useWikiHook.useWiki).mockReturnValue({
      wikiExists: true,
      pages: [],
      loading: false,
      error: null,
      gaps: [],
      gapsLoading: false,
      query: vi.fn(),
      lint: vi.fn(),
      ingest: vi.fn(),
      analyzeGaps: vi.fn(),
      refetch: vi.fn(),
    })

    render(<WikiPanel />)

    expect(screen.getByText(/No knowledge gaps found — your wiki is complete/)).toBeTruthy()
  })
})
