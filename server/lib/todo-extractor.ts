import { promises as fs } from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import os from 'node:os'

export interface TodoItem {
  id: string           // stable hash: sha256(filePath + ":" + lineNumber + ":" + text)
  text: string
  done: boolean
  file: string         // absolute path to source file
  line: number         // 1-based line number
  project: string      // derived from folder name relative to PROJECTS_DIR or VAULT_DIR
  type: 'checkbox' | 'todo_comment' | 'fixme' | 'hack'
  status: 'todo' | 'doing' | 'done'  // for checkbox items: - [ ] = todo, - [/] = doing, - [x] = done
}

export interface TodosResult {
  total: number
  completed: number
  byProject: Record<string, TodoItem[]>
}

/**
 * Generate a stable ID for a TODO item
 */
function generateTodoId(filePath: string, lineNumber: number, text: string): string {
  const hash = crypto.createHash('sha256')
  hash.update(`${filePath}:${lineNumber}:${text}`)
  return hash.digest('hex').substring(0, 16)
}

/**
 * Validate that a path is within allowed directories
 */
function validatePath(filePath: string, allowedDirs: string[]): boolean {
  const resolved = path.resolve(filePath)
  return allowedDirs.some(dir => {
    const resolvedDir = path.resolve(dir)
    return resolved.startsWith(resolvedDir + path.sep) || resolved === resolvedDir
  })
}

/**
 * Extract project name from file path relative to base directory
 */
function extractProjectName(filePath: string, projectsDir: string, vaultDirs: string[]): string {
  const resolvedFile = path.resolve(filePath)
  const resolvedProjects = path.resolve(projectsDir)

  if (resolvedFile.startsWith(resolvedProjects + path.sep)) {
    const relativePath = path.relative(resolvedProjects, resolvedFile)
    const parts = relativePath.split(path.sep)
    return parts[0] || 'Unknown'
  }

  for (const vaultDir of vaultDirs) {
    const resolvedVault = path.resolve(vaultDir)
    if (resolvedFile.startsWith(resolvedVault + path.sep)) {
      const relativePath = path.relative(resolvedVault, resolvedFile)
      const parts = relativePath.split(path.sep)
      return parts[0] || 'Vault'
    }
  }

  return 'Unknown'
}

/**
 * Parse TODO items from a markdown file
 */
async function extractTodosFromFile(
  filePath: string,
  projectsDir: string,
  vaultDirs: string[]
): Promise<TodoItem[]> {
  const content = await fs.readFile(filePath, 'utf-8')
  const lines = content.split('\n')
  const todos: TodoItem[] = []
  const project = extractProjectName(filePath, projectsDir, vaultDirs)

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const lineNumber = i + 1

    // Match checkbox: - [ ] or - [/] or - [x]
    const checkboxMatch = line.match(/^(\s*)-\s\[([ xX\/])\]\s+(.+)$/)
    if (checkboxMatch) {
      const text = checkboxMatch[3].trim()
      const marker = checkboxMatch[2]
      const done = marker.toLowerCase() === 'x'

      let status: 'todo' | 'doing' | 'done'
      if (marker.toLowerCase() === 'x') {
        status = 'done'
      } else if (marker === '/') {
        status = 'doing'
      } else {
        status = 'todo'
      }

      todos.push({
        id: generateTodoId(filePath, lineNumber, text),
        text,
        done,
        file: filePath,
        line: lineNumber,
        project,
        type: 'checkbox',
        status
      })
      continue
    }

    // Match TODO: comment (case-insensitive)
    const todoMatch = line.match(/\bTODO:\s*(.+)$/i)
    if (todoMatch) {
      const text = todoMatch[1].trim()
      todos.push({
        id: generateTodoId(filePath, lineNumber, text),
        text,
        done: false,
        file: filePath,
        line: lineNumber,
        project,
        type: 'todo_comment',
        status: 'todo'
      })
      continue
    }

    // Match FIXME: comment
    const fixmeMatch = line.match(/\bFIXME:\s*(.+)$/i)
    if (fixmeMatch) {
      const text = fixmeMatch[1].trim()
      todos.push({
        id: generateTodoId(filePath, lineNumber, text),
        text,
        done: false,
        file: filePath,
        line: lineNumber,
        project,
        type: 'fixme',
        status: 'todo'
      })
      continue
    }

    // Match HACK: comment
    const hackMatch = line.match(/\bHACK:\s*(.+)$/i)
    if (hackMatch) {
      const text = hackMatch[1].trim()
      todos.push({
        id: generateTodoId(filePath, lineNumber, text),
        text,
        done: false,
        file: filePath,
        line: lineNumber,
        project,
        type: 'hack',
        status: 'todo'
      })
    }
  }

  return todos
}

/**
 * Recursively find all markdown files in a directory
 */
async function findMarkdownFiles(dir: string): Promise<string[]> {
  const results: string[] = []

  let entries
  try {
    entries = await fs.readdir(dir, { withFileTypes: true })
  } catch (error) {
    // Skip directories we can't read
    return results
  }

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name)

    // Skip node_modules and .git directories
    if (entry.isDirectory() && (entry.name === 'node_modules' || entry.name === '.git')) {
      continue
    }

    if (entry.isDirectory()) {
      const subFiles = await findMarkdownFiles(fullPath)
      results.push(...subFiles)
    } else if (entry.isFile() && entry.name.endsWith('.md')) {
      // Check file size (skip files > 1MB)
      try {
        const stats = await fs.stat(fullPath)
        if (stats.size <= 1024 * 1024) {
          results.push(fullPath)
        }
      } catch (error) {
        // Skip files we can't stat
        continue
      }
    }
  }

  return results
}

/**
 * Extract all TODOs from projects and vault directories
 */
export async function extractTodos(
  projectsDir: string,
  vaultDir: string
): Promise<TodosResult> {
  return extractTodosMultiVault(projectsDir, [vaultDir])
}

/**
 * Extract all TODOs from projects directory and multiple vault directories
 */
export async function extractTodosMultiVault(
  projectsDir: string,
  vaultDirs: string[]
): Promise<TodosResult> {
  // Find all markdown files
  const projectFiles = await findMarkdownFiles(projectsDir)
  const vaultFileArrays = await Promise.all(vaultDirs.map(dir => findMarkdownFiles(dir)))
  const allFiles = [...projectFiles, ...vaultFileArrays.flat()]

  // Extract TODOs from all files
  const todoPromises = allFiles.map(file =>
    extractTodosFromFile(file, projectsDir, vaultDirs)
  )
  const todoArrays = await Promise.all(todoPromises)
  const allTodos = todoArrays.flat()

  // Group by project
  const byProject: Record<string, TodoItem[]> = {}
  for (const todo of allTodos) {
    if (!byProject[todo.project]) {
      byProject[todo.project] = []
    }
    byProject[todo.project].push(todo)
  }

  // Calculate totals
  const total = allTodos.length
  const completed = allTodos.filter(t => t.done).length

  return {
    total,
    completed,
    byProject
  }
}


/**
 * Toggle a checkbox TODO in its source file
 */
export async function toggleTodo(
  itemId: string,
  projectsDir: string,
  vaultDir: string,
  extraVaultDirs?: string[]
): Promise<void> {
  // Find the TODO item
  const allVaultDirs = extraVaultDirs ? [vaultDir, ...extraVaultDirs] : [vaultDir]
  const result = await extractTodosMultiVault(projectsDir, allVaultDirs)
  let todo: TodoItem | null = null
  for (const todos of Object.values(result.byProject)) {
    const found = todos.find(t => t.id === itemId)
    if (found) { todo = found; break }
  }

  if (!todo) {
    throw new Error('TODO item not found')
  }

  // Only checkboxes can be toggled
  if (todo.type !== 'checkbox') {
    throw new Error('Only checkbox TODOs can be toggled')
  }

  // Validate file path
  const allowedDirs = [projectsDir, ...allVaultDirs]
  if (!validatePath(todo.file, allowedDirs)) {
    throw new Error('File path is not within allowed directories')
  }

  // Read the file
  const content = await fs.readFile(todo.file, 'utf-8')
  const lines = content.split('\n')

  // Validate line number
  if (todo.line < 1 || todo.line > lines.length) {
    throw new Error('Invalid line number')
  }

  // Toggle the checkbox on the specific line
  const lineIndex = todo.line - 1
  const line = lines[lineIndex]

  // Toggle [ ] <-> [x]
  const newLine = todo.done
    ? line.replace(/- \[x\]/i, '- [ ]')
    : line.replace(/- \[ \]/, '- [x]')

  lines[lineIndex] = newLine

  // Write atomically: write to temp file, then rename
  const tmpFile = path.join(os.tmpdir(), `todo-${Date.now()}-${Math.random().toString(36).substring(7)}.md`)

  try {
    await fs.writeFile(tmpFile, lines.join('\n'), 'utf-8')
    await fs.rename(tmpFile, todo.file)
  } catch (error) {
    // Clean up temp file if it exists
    try {
      await fs.unlink(tmpFile)
    } catch {
      // Ignore cleanup errors
    }
    throw error
  }
}

/**
 * Update a checkbox TODO's status in its source file
 */
export async function updateTodoStatus(
  itemId: string,
  newStatus: 'todo' | 'doing' | 'done',
  projectsDir: string,
  vaultDir: string,
  extraVaultDirs?: string[]
): Promise<void> {
  // Find the TODO item
  const allVaultDirs = extraVaultDirs ? [vaultDir, ...extraVaultDirs] : [vaultDir]
  const result = await extractTodosMultiVault(projectsDir, allVaultDirs)
  let todo: TodoItem | null = null
  for (const todos of Object.values(result.byProject)) {
    const found = todos.find(t => t.id === itemId)
    if (found) { todo = found; break }
  }

  if (!todo) {
    throw new Error('TODO item not found')
  }

  // Only checkboxes can have their status changed
  if (todo.type !== 'checkbox') {
    throw new Error('Only checkbox TODOs can have their status changed')
  }

  // Validate file path
  const allowedDirs = [projectsDir, ...allVaultDirs]
  if (!validatePath(todo.file, allowedDirs)) {
    throw new Error('File path is not within allowed directories')
  }

  // Read the file
  const content = await fs.readFile(todo.file, 'utf-8')
  const lines = content.split('\n')

  // Validate line number
  if (todo.line < 1 || todo.line > lines.length) {
    throw new Error('Invalid line number')
  }

  // Determine the new checkbox marker based on status
  let newMarker: string
  if (newStatus === 'done') {
    newMarker = '[x]'
  } else if (newStatus === 'doing') {
    newMarker = '[/]'
  } else {
    newMarker = '[ ]'
  }

  // Replace the checkbox marker on the specific line
  const lineIndex = todo.line - 1
  const line = lines[lineIndex]

  // Replace any checkbox marker with the new one
  const newLine = line.replace(/- \[([ xX\/])\]/, `- ${newMarker}`)

  lines[lineIndex] = newLine

  // Write atomically: write to temp file, then rename
  const tmpFile = path.join(os.tmpdir(), `todo-${Date.now()}-${Math.random().toString(36).substring(7)}.md`)

  try {
    await fs.writeFile(tmpFile, lines.join('\n'), 'utf-8')
    await fs.rename(tmpFile, todo.file)
  } catch (error) {
    // Clean up temp file if it exists
    try {
      await fs.unlink(tmpFile)
    } catch {
      // Ignore cleanup errors
    }
    throw error
  }
}
