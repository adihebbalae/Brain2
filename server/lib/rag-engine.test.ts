import { describe, it, expect } from 'vitest'
import { extractKeywords, scoreChunks, assembleContext, getUniqueSources } from './rag-engine.js'
import type { Chunk } from './rag-engine.js'

describe('RAG Engine', () => {
  describe('extractKeywords', () => {
    it('should extract keywords from query', () => {
      const keywords = extractKeywords('What did I learn about React last month?')
      expect(keywords).toContain('learn')
      expect(keywords).toContain('react')
      expect(keywords).toContain('month')
    })

    it('should filter out stopwords', () => {
      const keywords = extractKeywords('What is the best way to learn?')
      expect(keywords).not.toContain('what')
      expect(keywords).not.toContain('is')
      expect(keywords).not.toContain('the')
      expect(keywords).not.toContain('to')
    })

    it('should apply simple stemming', () => {
      const keywords = extractKeywords('learning testing building')
      expect(keywords).toContain('learn')
      expect(keywords).toContain('test')
      expect(keywords).toContain('build')
    })

    it('should lowercase everything', () => {
      const keywords = extractKeywords('React TESTING Building')
      expect(keywords).toContain('react')
      expect(keywords).toContain('test')
      expect(keywords).toContain('build')
    })

    it('should handle empty query', () => {
      const keywords = extractKeywords('')
      expect(keywords).toEqual([])
    })

    it('should handle query with only stopwords', () => {
      const keywords = extractKeywords('the and is')
      expect(keywords).toEqual([])
    })
  })

  describe('scoreChunks', () => {
    const chunks: Chunk[] = [
      {
        id: '1',
        source: 'notes',
        title: 'React Hooks Guide',
        content: 'Learn about React hooks including useState and useEffect'
      },
      {
        id: '2',
        source: 'projects',
        title: 'Dashboard Project',
        content: 'Building a dashboard with React and TypeScript'
      },
      {
        id: '3',
        source: 'wiki',
        title: 'Python Tutorial',
        content: 'Introduction to Python programming'
      },
      {
        id: '4',
        source: 'notes',
        title: 'Testing Guide',
        content: 'How to test React components'
      }
    ]

    it('should return chunks matching keywords', () => {
      const results = scoreChunks('React', chunks)
      expect(results.length).toBeGreaterThan(0)
      expect(results.some(c => c.id === '1')).toBe(true) // React in title
      expect(results.some(c => c.id === '2')).toBe(true) // React in content
    })

    it('should rank title matches higher than content matches', () => {
      const results = scoreChunks('React', chunks)
      // Chunk 1 has React in title, chunk 2 has React in content
      // Chunk 1 should be ranked higher
      const chunk1Index = results.findIndex(c => c.id === '1')
      const chunk2Index = results.findIndex(c => c.id === '2')
      expect(chunk1Index).toBeLessThan(chunk2Index)
    })

    it('should return empty array when no matches', () => {
      const results = scoreChunks('Rust', chunks)
      expect(results).toEqual([])
    })

    it('should limit results to topN', () => {
      const results = scoreChunks('React', chunks, 1)
      expect(results.length).toBeLessThanOrEqual(1)
    })

    it('should handle empty chunks array', () => {
      const results = scoreChunks('React', [])
      expect(results).toEqual([])
    })

    it('should handle query with no keywords', () => {
      const results = scoreChunks('the and is', chunks)
      expect(results).toEqual([])
    })
  })

  describe('assembleContext', () => {
    const chunks: Chunk[] = [
      {
        id: '1',
        source: 'notes',
        title: 'First Note',
        content: 'This is the first note content'
      },
      {
        id: '2',
        source: 'projects',
        title: 'Second Project',
        content: 'This is the second project content'
      },
      {
        id: '3',
        source: 'wiki',
        title: 'Third Wiki',
        content: 'This is the third wiki content'
      }
    ]

    it('should format chunks with source and title headers', () => {
      const context = assembleContext(chunks)
      expect(context).toContain('[source: notes | title: "First Note"]')
      expect(context).toContain('[source: projects | title: "Second Project"]')
      expect(context).toContain('[source: wiki | title: "Third Wiki"]')
    })

    it('should include chunk content', () => {
      const context = assembleContext(chunks)
      expect(context).toContain('This is the first note content')
      expect(context).toContain('This is the second project content')
      expect(context).toContain('This is the third wiki content')
    })

    it('should respect maxChars limit', () => {
      const context = assembleContext(chunks, 100)
      expect(context.length).toBeLessThanOrEqual(100)
    })

    it('should truncate chunks when approaching maxChars', () => {
      const longChunks: Chunk[] = [
        {
          id: '1',
          source: 'notes',
          title: 'Long Note',
          content: 'A'.repeat(5000)
        },
        {
          id: '2',
          source: 'notes',
          title: 'Another Note',
          content: 'B'.repeat(5000)
        }
      ]

      const context = assembleContext(longChunks, 6000)
      expect(context.length).toBeLessThanOrEqual(6000)
      expect(context).toContain('...')
    })

    it('should handle empty chunks array', () => {
      const context = assembleContext([])
      expect(context).toBe('')
    })

    it('should handle single chunk', () => {
      const context = assembleContext([chunks[0]])
      expect(context).toContain('[source: notes | title: "First Note"]')
      expect(context).toContain('This is the first note content')
    })
  })

  describe('getUniqueSources', () => {
    it('should return unique source types', () => {
      const chunks: Chunk[] = [
        { id: '1', source: 'notes', title: 'A', content: 'a' },
        { id: '2', source: 'notes', title: 'B', content: 'b' },
        { id: '3', source: 'projects', title: 'C', content: 'c' },
        { id: '4', source: 'wiki', title: 'D', content: 'd' },
        { id: '5', source: 'notes', title: 'E', content: 'e' }
      ]

      const sources = getUniqueSources(chunks)
      expect(sources).toHaveLength(3)
      expect(sources).toContain('notes')
      expect(sources).toContain('projects')
      expect(sources).toContain('wiki')
    })

    it('should handle empty chunks array', () => {
      const sources = getUniqueSources([])
      expect(sources).toEqual([])
    })

    it('should handle single source type', () => {
      const chunks: Chunk[] = [
        { id: '1', source: 'notes', title: 'A', content: 'a' },
        { id: '2', source: 'notes', title: 'B', content: 'b' }
      ]

      const sources = getUniqueSources(chunks)
      expect(sources).toEqual(['notes'])
    })
  })
})
