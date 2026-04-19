import { promises as fs } from 'node:fs'
import path from 'node:path'
import { getVaultDirs } from './vault-config'

export interface GraphNode {
  id: string          // filename without extension
  label: string       // same as id (display name)
  folder: string      // PARA folder
  linkCount: number   // total wikilinks pointing TO this node
  filePath: string    // relative path from VAULT_DIR for Obsidian deep link
}

export interface GraphEdge {
  source: string      // node id
  target: string      // node id
}

export interface GraphData {
  nodes: GraphNode[]
  edges: GraphEdge[]
}

/**
 * Wikilink regex: [[Link]], [[Link|Alias]], [[Link#Heading]]
 * Captures the link target, ignoring aliases and anchors
 */
const WIKILINK_REGEX = /\[\[([^\]|#]+?)(?:[|#][^\]]*)?\]\]/g

/**
 * Determine PARA folder from file path
 */
function determinePARAFolder(filePath: string, vaultDir: string): string {
  const relativePath = path.relative(vaultDir, filePath)
  const parts = relativePath.split(path.sep)

  if (parts.length === 0) return 'other'

  const topFolder = parts[0].toLowerCase()

  if (topFolder === 'inbox') return 'inbox'
  if (topFolder === 'projects') return 'projects'
  if (topFolder === 'areas') return 'areas'
  if (topFolder === 'resources') return 'resources'
  if (topFolder === 'archive') return 'archive'
  if (topFolder === 'wiki') return 'wiki'
  if (topFolder === 'dailynotes') return 'dailynotes'

  return 'other'
}

/**
 * Recursively walk a directory and return all .md files
 */
async function walkMarkdownFiles(dir: string): Promise<string[]> {
  const files: string[] = []

  try {
    const entries = await fs.readdir(dir, { withFileTypes: true })

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name)

      // Skip node_modules and .git
      if (entry.name === 'node_modules' || entry.name === '.git') {
        continue
      }

      if (entry.isDirectory()) {
        const subFiles = await walkMarkdownFiles(fullPath)
        files.push(...subFiles)
      } else if (entry.isFile() && entry.name.endsWith('.md')) {
        files.push(fullPath)
      }
    }
  } catch (error) {
    // Directory doesn't exist or can't be read - skip it
    console.warn(`[wikilink-parser] Failed to read directory ${dir}:`, error)
  }

  return files
}

/**
 * Extract wikilinks from markdown content
 */
function extractWikilinks(content: string): string[] {
  const links: string[] = []
  let match: RegExpExecArray | null

  while ((match = WIKILINK_REGEX.exec(content)) !== null) {
    links.push(match[1].trim())
  }

  return links
}

/**
 * Parse all markdown files in vault directories and extract wikilink graph
 */
export async function parseWikilinkGraph(): Promise<GraphData> {
  const vaultDirs = await getVaultDirs()

  // Map: filename (without extension) -> { filePath, folder, linkedTo: Set<string> }
  const nodeMap = new Map<string, { filePath: string; folder: string; linkedTo: Set<string> }>()

  // Get primary vault dir for relative paths (for Obsidian deep links)
  const primaryVaultDir = vaultDirs[0] // VAULT_DIR is always first

  // Scan all vault directories
  for (const vaultDir of vaultDirs) {
    const markdownFiles = await walkMarkdownFiles(vaultDir)

    for (const filePath of markdownFiles) {
      // Get filename without extension
      const fileName = path.basename(filePath, '.md')

      // Skip if we've already seen this note (deduplication across vaults)
      if (nodeMap.has(fileName)) {
        continue
      }

      // Determine PARA folder
      const folder = determinePARAFolder(filePath, vaultDir)

      // Read file content
      let content: string
      try {
        content = await fs.readFile(filePath, 'utf-8')
      } catch (error) {
        console.warn(`[wikilink-parser] Failed to read file ${filePath}:`, error)
        continue
      }

      // Extract wikilinks
      const links = extractWikilinks(content)

      // Get relative path for Obsidian deep link (relative to primary vault)
      const relativeFilePath = path.relative(primaryVaultDir, filePath)

      // Store node data
      nodeMap.set(fileName, {
        filePath: relativeFilePath,
        folder,
        linkedTo: new Set(links.filter(link => link !== fileName)) // Exclude self-loops
      })
    }
  }

  // Build edges
  const edges: GraphEdge[] = []
  const inboundLinkCounts = new Map<string, number>()

  for (const [sourceId, data] of nodeMap) {
    for (const targetId of data.linkedTo) {
      edges.push({ source: sourceId, target: targetId })

      // Count inbound links
      inboundLinkCounts.set(targetId, (inboundLinkCounts.get(targetId) || 0) + 1)
    }
  }

  // Build nodes
  const nodes: GraphNode[] = []
  for (const [id, data] of nodeMap) {
    nodes.push({
      id,
      label: id,
      folder: data.folder,
      linkCount: inboundLinkCounts.get(id) || 0,
      filePath: data.filePath
    })
  }

  return { nodes, edges }
}

/**
 * Filter graph data to top N nodes by linkCount
 */
export function filterGraphByLimit(graphData: GraphData, limit: number): GraphData {
  // Sort nodes by linkCount descending, then alphabetically by id
  const sortedNodes = [...graphData.nodes].sort((a, b) => {
    if (b.linkCount !== a.linkCount) {
      return b.linkCount - a.linkCount
    }
    return a.id.localeCompare(b.id)
  })

  // Take top N nodes
  const topNodes = sortedNodes.slice(0, limit)
  const nodeIds = new Set(topNodes.map(n => n.id))

  // Filter edges: only include edges where both source and target are in the node set
  const filteredEdges = graphData.edges.filter(
    edge => nodeIds.has(edge.source) && nodeIds.has(edge.target)
  )

  return {
    nodes: topNodes,
    edges: filteredEdges
  }
}
