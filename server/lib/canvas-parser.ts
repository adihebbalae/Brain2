import { promises as fs } from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'

export interface CanvasData {
  filename: string // basename without .canvas
  filePath: string // relative path from VAULT_DIR
  nodeCount: number
  edgeCount: number
  textPreview: string[] // first 3 text node contents, trimmed to 80 chars each
  fileNodes: string[] // list of referenced vault files
  lastModified: string // ISO date
}

interface CanvasNode {
  id: string
  type: 'text' | 'file' | 'link' | 'group'
  text?: string
  file?: string
  url?: string
  x: number
  y: number
  width: number
  height: number
  color?: string
}

interface CanvasEdge {
  id: string
  fromNode: string
  toNode: string
}

interface CanvasFile {
  nodes: CanvasNode[]
  edges: CanvasEdge[]
}

/**
 * Parses a .canvas file and returns structured metadata.
 * Returns null if the file is malformed or cannot be parsed.
 */
export async function parseCanvas(filePath: string, vaultDir: string): Promise<CanvasData | null> {
  try {
    const content = await fs.readFile(filePath, 'utf-8')
    const canvas: CanvasFile = JSON.parse(content)

    // Validate basic structure
    if (!canvas.nodes || !Array.isArray(canvas.nodes)) {
      console.warn(`[canvas-parser] Invalid canvas structure (missing nodes array): ${filePath}`)
      return null
    }
    if (!canvas.edges || !Array.isArray(canvas.edges)) {
      console.warn(`[canvas-parser] Invalid canvas structure (missing edges array): ${filePath}`)
      return null
    }

    // Extract text previews (first 3 text nodes)
    const textPreview: string[] = []
    const fileNodes: string[] = []

    for (const node of canvas.nodes) {
      if (node.type === 'text' && node.text) {
        if (textPreview.length < 3) {
          const trimmed = node.text.trim().substring(0, 80)
          if (trimmed) {
            textPreview.push(trimmed)
          }
        }
      } else if (node.type === 'file' && node.file) {
        fileNodes.push(node.file)
      }
    }

    // Get file stats for lastModified
    const stat = await fs.stat(filePath)

    // Compute relative path from vault dir
    const resolvedVaultDir = path.resolve(vaultDir)
    const resolvedFilePath = path.resolve(filePath)
    const relativePath = path.relative(resolvedVaultDir, resolvedFilePath)

    // Extract filename without .canvas extension
    const basename = path.basename(filePath, '.canvas')

    return {
      filename: basename,
      filePath: relativePath,
      nodeCount: canvas.nodes.length,
      edgeCount: canvas.edges.length,
      textPreview,
      fileNodes,
      lastModified: stat.mtime.toISOString(),
    }
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
      return null
    }
    if (err instanceof SyntaxError) {
      console.warn(`[canvas-parser] Malformed JSON in canvas file: ${filePath}`)
      return null
    }
    console.error(`[canvas-parser] Error parsing canvas file ${filePath}:`, err)
    return null
  }
}

/**
 * Adds a new text node to a canvas file.
 * @param filePath Absolute path to the .canvas file
 * @param text Text content for the new node
 * @param color Optional color code ("1"=red, "2"=orange, "3"=yellow, "4"=green, "5"=cyan, "6"=purple)
 */
export async function addNodeToCanvas(filePath: string, text: string, color?: string): Promise<void> {
  // Read existing canvas
  const content = await fs.readFile(filePath, 'utf-8')
  const canvas: CanvasFile = JSON.parse(content)

  // Validate structure
  if (!canvas.nodes || !Array.isArray(canvas.nodes)) {
    throw new Error('Invalid canvas structure: missing nodes array')
  }
  if (!canvas.edges || !Array.isArray(canvas.edges)) {
    throw new Error('Invalid canvas structure: missing edges array')
  }

  // Find max Y position
  let maxY = 0
  for (const node of canvas.nodes) {
    const nodeBottom = node.y + (node.height || 0)
    if (nodeBottom > maxY) {
      maxY = nodeBottom
    }
  }

  // Generate random 8-char hex ID
  const id = crypto.randomBytes(4).toString('hex')

  // Create new node
  const newNode: CanvasNode = {
    id,
    type: 'text',
    text,
    x: 0,
    y: maxY + 100,
    width: 250,
    height: 60,
  }

  // Add color if specified
  if (color && ['1', '2', '3', '4', '5', '6'].includes(color)) {
    newNode.color = color
  }

  // Append to nodes array
  canvas.nodes.push(newNode)

  // Write back to file
  const updatedContent = JSON.stringify(canvas, null, 2)
  await fs.writeFile(filePath, updatedContent, 'utf-8')
}
