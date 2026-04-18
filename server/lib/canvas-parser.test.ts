import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { promises as fs } from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { parseCanvas, addNodeToCanvas } from './canvas-parser.js'

describe('canvas-parser', () => {
  let tempDir: string

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'canvas-test-'))
  })

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true })
  })

  describe('parseCanvas', () => {
    it('should parse a valid canvas file with text nodes', async () => {
      const canvasPath = path.join(tempDir, 'test.canvas')
      const canvas = {
        nodes: [
          { id: 'abc', type: 'text', text: 'My idea here', x: 0, y: 0, width: 250, height: 60 },
          { id: 'def', type: 'text', text: 'Another idea', x: 300, y: 0, width: 250, height: 60 },
        ],
        edges: [
          { id: 'edge1', fromNode: 'abc', toNode: 'def' },
        ],
      }
      await fs.writeFile(canvasPath, JSON.stringify(canvas), 'utf-8')

      const result = await parseCanvas(canvasPath, tempDir)

      expect(result).not.toBeNull()
      expect(result?.filename).toBe('test')
      expect(result?.nodeCount).toBe(2)
      expect(result?.edgeCount).toBe(1)
      expect(result?.textPreview).toHaveLength(2)
      expect(result?.textPreview[0]).toBe('My idea here')
      expect(result?.textPreview[1]).toBe('Another idea')
      expect(result?.fileNodes).toHaveLength(0)
    })

    it('should parse a canvas with file nodes', async () => {
      const canvasPath = path.join(tempDir, 'project.canvas')
      const canvas = {
        nodes: [
          { id: 'abc', type: 'text', text: 'Project overview', x: 0, y: 0, width: 250, height: 60 },
          { id: 'def', type: 'file', file: 'Projects/MyProject.md', x: 300, y: 0, width: 400, height: 300 },
          { id: 'ghi', type: 'file', file: 'Notes/Ideas.md', x: 750, y: 0, width: 400, height: 300 },
        ],
        edges: [],
      }
      await fs.writeFile(canvasPath, JSON.stringify(canvas), 'utf-8')

      const result = await parseCanvas(canvasPath, tempDir)

      expect(result).not.toBeNull()
      expect(result?.nodeCount).toBe(3)
      expect(result?.edgeCount).toBe(0)
      expect(result?.fileNodes).toHaveLength(2)
      expect(result?.fileNodes).toContain('Projects/MyProject.md')
      expect(result?.fileNodes).toContain('Notes/Ideas.md')
      expect(result?.textPreview).toHaveLength(1)
    })

    it('should handle canvas with link and group nodes', async () => {
      const canvasPath = path.join(tempDir, 'mixed.canvas')
      const canvas = {
        nodes: [
          { id: 'a', type: 'text', text: 'Text node', x: 0, y: 0, width: 250, height: 60 },
          { id: 'b', type: 'link', url: 'https://example.com', x: 300, y: 0, width: 400, height: 300 },
          { id: 'c', type: 'group', x: 750, y: 0, width: 500, height: 400 },
        ],
        edges: [],
      }
      await fs.writeFile(canvasPath, JSON.stringify(canvas), 'utf-8')

      const result = await parseCanvas(canvasPath, tempDir)

      expect(result).not.toBeNull()
      expect(result?.nodeCount).toBe(3)
      expect(result?.textPreview).toHaveLength(1)
      expect(result?.fileNodes).toHaveLength(0)
    })

    it('should limit text preview to first 3 nodes', async () => {
      const canvasPath = path.join(tempDir, 'many-nodes.canvas')
      const canvas = {
        nodes: [
          { id: '1', type: 'text', text: 'First', x: 0, y: 0, width: 250, height: 60 },
          { id: '2', type: 'text', text: 'Second', x: 0, y: 100, width: 250, height: 60 },
          { id: '3', type: 'text', text: 'Third', x: 0, y: 200, width: 250, height: 60 },
          { id: '4', type: 'text', text: 'Fourth', x: 0, y: 300, width: 250, height: 60 },
          { id: '5', type: 'text', text: 'Fifth', x: 0, y: 400, width: 250, height: 60 },
        ],
        edges: [],
      }
      await fs.writeFile(canvasPath, JSON.stringify(canvas), 'utf-8')

      const result = await parseCanvas(canvasPath, tempDir)

      expect(result).not.toBeNull()
      expect(result?.textPreview).toHaveLength(3)
      expect(result?.textPreview).toEqual(['First', 'Second', 'Third'])
    })

    it('should truncate long text to 80 characters', async () => {
      const longText = 'a'.repeat(100)
      const canvasPath = path.join(tempDir, 'long-text.canvas')
      const canvas = {
        nodes: [
          { id: 'a', type: 'text', text: longText, x: 0, y: 0, width: 250, height: 60 },
        ],
        edges: [],
      }
      await fs.writeFile(canvasPath, JSON.stringify(canvas), 'utf-8')

      const result = await parseCanvas(canvasPath, tempDir)

      expect(result).not.toBeNull()
      expect(result?.textPreview[0]).toHaveLength(80)
    })

    it('should handle empty canvas', async () => {
      const canvasPath = path.join(tempDir, 'empty.canvas')
      const canvas = {
        nodes: [],
        edges: [],
      }
      await fs.writeFile(canvasPath, JSON.stringify(canvas), 'utf-8')

      const result = await parseCanvas(canvasPath, tempDir)

      expect(result).not.toBeNull()
      expect(result?.nodeCount).toBe(0)
      expect(result?.edgeCount).toBe(0)
      expect(result?.textPreview).toHaveLength(0)
      expect(result?.fileNodes).toHaveLength(0)
    })

    it('should return null for malformed JSON', async () => {
      const canvasPath = path.join(tempDir, 'malformed.canvas')
      await fs.writeFile(canvasPath, '{ invalid json', 'utf-8')

      const result = await parseCanvas(canvasPath, tempDir)

      expect(result).toBeNull()
    })

    it('should return null for missing nodes array', async () => {
      const canvasPath = path.join(tempDir, 'no-nodes.canvas')
      await fs.writeFile(canvasPath, JSON.stringify({ edges: [] }), 'utf-8')

      const result = await parseCanvas(canvasPath, tempDir)

      expect(result).toBeNull()
    })

    it('should return null for missing edges array', async () => {
      const canvasPath = path.join(tempDir, 'no-edges.canvas')
      await fs.writeFile(canvasPath, JSON.stringify({ nodes: [] }), 'utf-8')

      const result = await parseCanvas(canvasPath, tempDir)

      expect(result).toBeNull()
    })

    it('should return null for non-existent file', async () => {
      const canvasPath = path.join(tempDir, 'does-not-exist.canvas')

      const result = await parseCanvas(canvasPath, tempDir)

      expect(result).toBeNull()
    })

    it('should include lastModified timestamp', async () => {
      const canvasPath = path.join(tempDir, 'timestamp.canvas')
      const canvas = { nodes: [], edges: [] }
      await fs.writeFile(canvasPath, JSON.stringify(canvas), 'utf-8')

      const result = await parseCanvas(canvasPath, tempDir)

      expect(result).not.toBeNull()
      expect(result?.lastModified).toBeTruthy()
      expect(new Date(result!.lastModified).getTime()).toBeGreaterThan(0)
    })
  })

  describe('addNodeToCanvas', () => {
    it('should add a text node to canvas', async () => {
      const canvasPath = path.join(tempDir, 'add-node.canvas')
      const canvas = {
        nodes: [
          { id: 'abc', type: 'text', text: 'Existing node', x: 0, y: 0, width: 250, height: 60 },
        ],
        edges: [],
      }
      await fs.writeFile(canvasPath, JSON.stringify(canvas, null, 2), 'utf-8')

      await addNodeToCanvas(canvasPath, 'New node text')

      const updated = JSON.parse(await fs.readFile(canvasPath, 'utf-8'))
      expect(updated.nodes).toHaveLength(2)
      expect(updated.nodes[1].type).toBe('text')
      expect(updated.nodes[1].text).toBe('New node text')
      expect(updated.nodes[1].x).toBe(0)
      expect(updated.nodes[1].y).toBe(160) // 0 + 60 + 100
      expect(updated.nodes[1].width).toBe(250)
      expect(updated.nodes[1].height).toBe(60)
    })

    it('should add node below all existing nodes', async () => {
      const canvasPath = path.join(tempDir, 'multi-node.canvas')
      const canvas = {
        nodes: [
          { id: 'a', type: 'text', text: 'First', x: 0, y: 0, width: 250, height: 60 },
          { id: 'b', type: 'text', text: 'Second', x: 300, y: 100, width: 250, height: 80 },
          { id: 'c', type: 'text', text: 'Third', x: 600, y: 50, width: 250, height: 100 },
        ],
        edges: [],
      }
      await fs.writeFile(canvasPath, JSON.stringify(canvas, null, 2), 'utf-8')

      await addNodeToCanvas(canvasPath, 'Below all')

      const updated = JSON.parse(await fs.readFile(canvasPath, 'utf-8'))
      expect(updated.nodes).toHaveLength(4)
      // Max Y is node 'b' at y=100 + height=80 = 180
      expect(updated.nodes[3].y).toBe(280) // 180 + 100
    })

    it('should add node with color', async () => {
      const canvasPath = path.join(tempDir, 'colored.canvas')
      const canvas = { nodes: [], edges: [] }
      await fs.writeFile(canvasPath, JSON.stringify(canvas, null, 2), 'utf-8')

      await addNodeToCanvas(canvasPath, 'Red node', '1')

      const updated = JSON.parse(await fs.readFile(canvasPath, 'utf-8'))
      expect(updated.nodes[0].color).toBe('1')
    })

    it('should generate unique random ID', async () => {
      const canvasPath = path.join(tempDir, 'unique-id.canvas')
      const canvas = { nodes: [], edges: [] }
      await fs.writeFile(canvasPath, JSON.stringify(canvas, null, 2), 'utf-8')

      await addNodeToCanvas(canvasPath, 'First')
      await addNodeToCanvas(canvasPath, 'Second')

      const updated = JSON.parse(await fs.readFile(canvasPath, 'utf-8'))
      expect(updated.nodes).toHaveLength(2)
      expect(updated.nodes[0].id).toBeTruthy()
      expect(updated.nodes[1].id).toBeTruthy()
      expect(updated.nodes[0].id).not.toBe(updated.nodes[1].id)
      expect(updated.nodes[0].id).toHaveLength(8)
      expect(updated.nodes[1].id).toHaveLength(8)
    })

    it('should throw error for invalid canvas structure (no nodes)', async () => {
      const canvasPath = path.join(tempDir, 'invalid.canvas')
      await fs.writeFile(canvasPath, JSON.stringify({ edges: [] }), 'utf-8')

      await expect(addNodeToCanvas(canvasPath, 'Test')).rejects.toThrow('Invalid canvas structure')
    })

    it('should throw error for invalid canvas structure (no edges)', async () => {
      const canvasPath = path.join(tempDir, 'invalid2.canvas')
      await fs.writeFile(canvasPath, JSON.stringify({ nodes: [] }), 'utf-8')

      await expect(addNodeToCanvas(canvasPath, 'Test')).rejects.toThrow('Invalid canvas structure')
    })

    it('should support all color codes', async () => {
      const canvasPath = path.join(tempDir, 'colors.canvas')
      const canvas = { nodes: [], edges: [] }
      await fs.writeFile(canvasPath, JSON.stringify(canvas, null, 2), 'utf-8')

      const colors = ['1', '2', '3', '4', '5', '6']
      for (const color of colors) {
        await addNodeToCanvas(canvasPath, `Node ${color}`, color)
      }

      const updated = JSON.parse(await fs.readFile(canvasPath, 'utf-8'))
      expect(updated.nodes).toHaveLength(6)
      updated.nodes.forEach((node: any, idx: number) => {
        expect(node.color).toBe(colors[idx])
      })
    })

    it('should not add color property for invalid color codes', async () => {
      const canvasPath = path.join(tempDir, 'no-color.canvas')
      const canvas = { nodes: [], edges: [] }
      await fs.writeFile(canvasPath, JSON.stringify(canvas, null, 2), 'utf-8')

      await addNodeToCanvas(canvasPath, 'No color', '7') // Invalid color

      const updated = JSON.parse(await fs.readFile(canvasPath, 'utf-8'))
      expect(updated.nodes[0].color).toBeUndefined()
    })
  })
})
