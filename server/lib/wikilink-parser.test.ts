import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { promises as fs } from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { parseWikilinkGraph, filterGraphByLimit } from './wikilink-parser'

describe('wikilink-parser', () => {
  let tempDir: string

  beforeEach(async () => {
    // Create temp directory
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'cortex-graph-test-'))

    // Set VAULT_DIR to temp directory
    process.env.VAULT_DIR = tempDir
    delete process.env.VAULT_DIRS
  })

  afterEach(async () => {
    // Clean up temp directory
    await fs.rm(tempDir, { recursive: true, force: true })
  })

  describe('parseWikilinkGraph', () => {
    it('should return empty graph for empty vault', async () => {
      const result = await parseWikilinkGraph()

      expect(result.nodes).toEqual([])
      expect(result.edges).toEqual([])
    })

    it('should parse simple wikilink [[Link]]', async () => {
      await fs.writeFile(
        path.join(tempDir, 'source.md'),
        'This is a [[target]] link'
      )
      await fs.writeFile(
        path.join(tempDir, 'target.md'),
        'Target content'
      )

      const result = await parseWikilinkGraph()

      expect(result.nodes).toHaveLength(2)
      expect(result.edges).toHaveLength(1)
      expect(result.edges[0]).toEqual({
        source: 'source',
        target: 'target'
      })
    })

    it('should parse wikilink with alias [[Link|Alias]]', async () => {
      await fs.writeFile(
        path.join(tempDir, 'note.md'),
        'Link with [[target|alias]] text'
      )
      await fs.writeFile(
        path.join(tempDir, 'target.md'),
        'Content'
      )

      const result = await parseWikilinkGraph()

      expect(result.edges).toHaveLength(1)
      expect(result.edges[0]).toEqual({
        source: 'note',
        target: 'target'
      })
    })

    it('should parse wikilink with heading [[Link#Heading]]', async () => {
      await fs.writeFile(
        path.join(tempDir, 'note.md'),
        'Link to [[target#section]] heading'
      )
      await fs.writeFile(
        path.join(tempDir, 'target.md'),
        'Content'
      )

      const result = await parseWikilinkGraph()

      expect(result.edges).toHaveLength(1)
      expect(result.edges[0]).toEqual({
        source: 'note',
        target: 'target'
      })
    })

    it('should parse multiple wikilinks in one file', async () => {
      await fs.writeFile(
        path.join(tempDir, 'source.md'),
        'Links to [[target1]] and [[target2]] and [[target3]]'
      )
      await fs.writeFile(path.join(tempDir, 'target1.md'), 'T1')
      await fs.writeFile(path.join(tempDir, 'target2.md'), 'T2')
      await fs.writeFile(path.join(tempDir, 'target3.md'), 'T3')

      const result = await parseWikilinkGraph()

      expect(result.nodes).toHaveLength(4)
      expect(result.edges).toHaveLength(3)
    })

    it('should count inbound links correctly', async () => {
      // Three notes linking to hub
      await fs.writeFile(
        path.join(tempDir, 'note1.md'),
        'Link to [[hub]]'
      )
      await fs.writeFile(
        path.join(tempDir, 'note2.md'),
        'Another link to [[hub]]'
      )
      await fs.writeFile(
        path.join(tempDir, 'note3.md'),
        'Yet another link to [[hub]]'
      )
      await fs.writeFile(
        path.join(tempDir, 'hub.md'),
        'Hub content'
      )

      const result = await parseWikilinkGraph()

      const hubNode = result.nodes.find(n => n.id === 'hub')
      expect(hubNode).toBeDefined()
      expect(hubNode?.linkCount).toBe(3)
    })

    it('should determine PARA folder correctly', async () => {
      // Create PARA structure
      await fs.mkdir(path.join(tempDir, 'Projects'), { recursive: true })
      await fs.mkdir(path.join(tempDir, 'Areas'), { recursive: true })
      await fs.mkdir(path.join(tempDir, 'Resources'), { recursive: true })
      await fs.mkdir(path.join(tempDir, 'Wiki'), { recursive: true })

      await fs.writeFile(path.join(tempDir, 'Projects', 'project.md'), 'Project')
      await fs.writeFile(path.join(tempDir, 'Areas', 'area.md'), 'Area')
      await fs.writeFile(path.join(tempDir, 'Resources', 'resource.md'), 'Resource')
      await fs.writeFile(path.join(tempDir, 'Wiki', 'wiki.md'), 'Wiki')
      await fs.writeFile(path.join(tempDir, 'other.md'), 'Other')

      const result = await parseWikilinkGraph()

      const projectNode = result.nodes.find(n => n.id === 'project')
      const areaNode = result.nodes.find(n => n.id === 'area')
      const resourceNode = result.nodes.find(n => n.id === 'resource')
      const wikiNode = result.nodes.find(n => n.id === 'wiki')
      const otherNode = result.nodes.find(n => n.id === 'other')

      expect(projectNode?.folder).toBe('projects')
      expect(areaNode?.folder).toBe('areas')
      expect(resourceNode?.folder).toBe('resources')
      expect(wikiNode?.folder).toBe('wiki')
      expect(otherNode?.folder).toBe('other')
    })

    it('should ignore self-loops', async () => {
      await fs.writeFile(
        path.join(tempDir, 'note.md'),
        'Self reference to [[note]] is ignored'
      )

      const result = await parseWikilinkGraph()

      expect(result.nodes).toHaveLength(1)
      expect(result.edges).toHaveLength(0)
    })

    it('should handle nested directories', async () => {
      await fs.mkdir(path.join(tempDir, 'Projects', 'SubFolder'), { recursive: true })
      await fs.writeFile(
        path.join(tempDir, 'Projects', 'SubFolder', 'deep.md'),
        'Deep note'
      )

      const result = await parseWikilinkGraph()

      const deepNode = result.nodes.find(n => n.id === 'deep')
      expect(deepNode).toBeDefined()
      expect(deepNode?.folder).toBe('projects')
    })

    it('should skip node_modules and .git directories', async () => {
      await fs.mkdir(path.join(tempDir, 'node_modules'), { recursive: true })
      await fs.mkdir(path.join(tempDir, '.git'), { recursive: true })

      await fs.writeFile(path.join(tempDir, 'node_modules', 'lib.md'), 'Lib')
      await fs.writeFile(path.join(tempDir, '.git', 'config.md'), 'Config')
      await fs.writeFile(path.join(tempDir, 'normal.md'), 'Normal')

      const result = await parseWikilinkGraph()

      // Should only find normal.md
      expect(result.nodes).toHaveLength(1)
      expect(result.nodes[0].id).toBe('normal')
    })

    it('should set correct file path for Obsidian deep links', async () => {
      await fs.mkdir(path.join(tempDir, 'Projects'), { recursive: true })
      await fs.writeFile(
        path.join(tempDir, 'Projects', 'project.md'),
        'Project'
      )

      const result = await parseWikilinkGraph()

      const projectNode = result.nodes.find(n => n.id === 'project')
      expect(projectNode?.filePath).toBe(path.join('Projects', 'project.md'))
    })

    it('should handle notes with no wikilinks', async () => {
      await fs.writeFile(
        path.join(tempDir, 'note.md'),
        'Just plain text, no links'
      )

      const result = await parseWikilinkGraph()

      expect(result.nodes).toHaveLength(1)
      expect(result.edges).toHaveLength(0)

      const node = result.nodes[0]
      expect(node.id).toBe('note')
      expect(node.linkCount).toBe(0)
    })
  })

  describe('filterGraphByLimit', () => {
    it('should return all nodes when limit is higher than node count', () => {
      const graphData = {
        nodes: [
          { id: 'a', label: 'a', folder: 'wiki', linkCount: 5, filePath: 'a.md' },
          { id: 'b', label: 'b', folder: 'wiki', linkCount: 3, filePath: 'b.md' }
        ],
        edges: [
          { source: 'a', target: 'b' }
        ]
      }

      const result = filterGraphByLimit(graphData, 10)

      expect(result.nodes).toHaveLength(2)
      expect(result.edges).toHaveLength(1)
    })

    it('should limit nodes by linkCount (highest first)', () => {
      const graphData = {
        nodes: [
          { id: 'low', label: 'low', folder: 'wiki', linkCount: 1, filePath: 'low.md' },
          { id: 'high', label: 'high', folder: 'wiki', linkCount: 10, filePath: 'high.md' },
          { id: 'mid', label: 'mid', folder: 'wiki', linkCount: 5, filePath: 'mid.md' }
        ],
        edges: [
          { source: 'low', target: 'high' },
          { source: 'mid', target: 'high' }
        ]
      }

      const result = filterGraphByLimit(graphData, 2)

      expect(result.nodes).toHaveLength(2)
      expect(result.nodes[0].id).toBe('high')
      expect(result.nodes[1].id).toBe('mid')
    })

    it('should filter edges when nodes are excluded', () => {
      const graphData = {
        nodes: [
          { id: 'keep', label: 'keep', folder: 'wiki', linkCount: 10, filePath: 'keep.md' },
          { id: 'remove', label: 'remove', folder: 'wiki', linkCount: 1, filePath: 'remove.md' }
        ],
        edges: [
          { source: 'keep', target: 'remove' },
          { source: 'remove', target: 'keep' }
        ]
      }

      const result = filterGraphByLimit(graphData, 1)

      expect(result.nodes).toHaveLength(1)
      expect(result.edges).toHaveLength(0) // Both edges should be removed
    })

    it('should sort alphabetically when linkCount is equal', () => {
      const graphData = {
        nodes: [
          { id: 'zebra', label: 'zebra', folder: 'wiki', linkCount: 5, filePath: 'zebra.md' },
          { id: 'apple', label: 'apple', folder: 'wiki', linkCount: 5, filePath: 'apple.md' },
          { id: 'banana', label: 'banana', folder: 'wiki', linkCount: 5, filePath: 'banana.md' }
        ],
        edges: []
      }

      const result = filterGraphByLimit(graphData, 2)

      expect(result.nodes).toHaveLength(2)
      expect(result.nodes[0].id).toBe('apple')
      expect(result.nodes[1].id).toBe('banana')
    })
  })
})
