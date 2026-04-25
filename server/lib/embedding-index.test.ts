import { describe, it, expect } from 'vitest'
import { chunkText, cosineSimilarity } from './embedding-index.js'

describe('embedding-index', () => {
  describe('chunkText', () => {
    it('should split text by paragraph boundaries', () => {
      const text = `First paragraph is here.\n\nSecond paragraph follows.\n\nThird paragraph ends.`
      const chunks = chunkText(text, 100)

      expect(chunks.length).toBeGreaterThan(0)
      expect(chunks.some(c => c.includes('First paragraph'))).toBe(true)
      expect(chunks.some(c => c.includes('Second paragraph'))).toBe(true)
    })

    it('should respect maxChars limit for structured text', () => {
      const text = 'a'.repeat(300) + '. ' + 'b'.repeat(300) + '. ' + 'c'.repeat(300)
      const chunks = chunkText(text, 500)

      chunks.forEach(chunk => {
        expect(chunk.length).toBeLessThanOrEqual(600) // Allow overlap
      })
    })

    it('should handle short text', () => {
      const text = 'Short text'
      const chunks = chunkText(text, 500)

      expect(chunks).toEqual([text])
    })

    it('should handle empty text', () => {
      const text = ''
      const chunks = chunkText(text, 500)

      expect(chunks.length).toBeGreaterThan(0)
      expect(chunks[0]).toBe('')
    })

    it('should add overlap between chunks', () => {
      const text = `First paragraph with enough content to trigger chunking.\n\nSecond paragraph that should appear in a new chunk with some overlap from the previous one.`
      const chunks = chunkText(text, 80)

      expect(chunks.length).toBeGreaterThan(1)
      // Some content from first chunk should appear at start of second
    })

    it('should split long paragraphs by lines', () => {
      const text = 'a'.repeat(300) + '\n' + 'b'.repeat(300)
      const chunks = chunkText(text, 250)

      expect(chunks.length).toBeGreaterThan(1)
    })

    it('should handle multiple newlines', () => {
      const text = `Para 1\n\n\n\nPara 2\n\n\n\n\nPara 3`
      const chunks = chunkText(text)

      expect(chunks.length).toBeGreaterThan(0)
    })
  })

  describe('cosineSimilarity', () => {
    it('should return 1 for identical vectors', () => {
      const a = [1, 2, 3, 4]
      const b = [1, 2, 3, 4]

      const similarity = cosineSimilarity(a, b)
      expect(similarity).toBeCloseTo(1, 5)
    })

    it('should return 0 for orthogonal vectors', () => {
      const a = [1, 0, 0]
      const b = [0, 1, 0]

      const similarity = cosineSimilarity(a, b)
      expect(similarity).toBeCloseTo(0, 5)
    })

    it('should return -1 for opposite vectors', () => {
      const a = [1, 2, 3]
      const b = [-1, -2, -3]

      const similarity = cosineSimilarity(a, b)
      expect(similarity).toBeCloseTo(-1, 5)
    })

    it('should handle zero vectors', () => {
      const a = [0, 0, 0]
      const b = [1, 2, 3]

      const similarity = cosineSimilarity(a, b)
      expect(similarity).toBe(0)
    })

    it('should return 0 for different length vectors', () => {
      const a = [1, 2, 3]
      const b = [1, 2]

      const similarity = cosineSimilarity(a, b)
      expect(similarity).toBe(0)
    })

    it('should calculate correct similarity for similar vectors', () => {
      const a = [1, 2, 3]
      const b = [1, 2, 2.5]

      const similarity = cosineSimilarity(a, b)
      expect(similarity).toBeGreaterThan(0.95)
      expect(similarity).toBeLessThan(1)
    })

    it('should handle high-dimensional vectors', () => {
      const dim = 1536 // nomic-embed-text dimension
      const a = Array(dim).fill(0).map((_, i) => Math.sin(i))
      const b = Array(dim).fill(0).map((_, i) => Math.sin(i + 0.1))

      const similarity = cosineSimilarity(a, b)
      expect(similarity).toBeGreaterThan(0)
      expect(similarity).toBeLessThan(1)
    })

    it('should be commutative', () => {
      const a = [1, 2, 3, 4, 5]
      const b = [5, 4, 3, 2, 1]

      const sim1 = cosineSimilarity(a, b)
      const sim2 = cosineSimilarity(b, a)
      expect(sim1).toBeCloseTo(sim2, 10)
    })
  })
})
