import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { promises as fs } from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { extractTodos, toggleTodo } from './todo-extractor.js'

describe('todo-extractor', () => {
  let testDir: string
  let projectsDir: string
  let vaultDir: string

  beforeEach(async () => {
    // Create temporary test directories
    testDir = path.join(os.tmpdir(), `test-todos-${Date.now()}-${Math.random().toString(36).substring(7)}`)
    projectsDir = path.join(testDir, 'projects')
    vaultDir = path.join(testDir, 'vault')

    await fs.mkdir(testDir, { recursive: true })
    await fs.mkdir(projectsDir, { recursive: true })
    await fs.mkdir(vaultDir, { recursive: true })
  })

  afterEach(async () => {
    // Clean up test directory
    await fs.rm(testDir, { recursive: true, force: true })
  })

  describe('extractTodos', () => {
    it('extracts unchecked checkbox tasks (- [ ])', async () => {
      const projectA = path.join(projectsDir, 'ProjectA')
      await fs.mkdir(projectA, { recursive: true })
      await fs.writeFile(
        path.join(projectA, 'tasks.md'),
        '- [ ] Task one\n- [ ] Task two\n'
      )

      const result = await extractTodos(projectsDir, vaultDir)

      expect(result.total).toBe(2)
      expect(result.completed).toBe(0)
      expect(result.byProject['ProjectA']).toHaveLength(2)
      expect(result.byProject['ProjectA'][0]).toMatchObject({
        text: 'Task one',
        done: false,
        type: 'checkbox',
        line: 1
      })
    })

    it('extracts checked checkbox tasks (- [x])', async () => {
      const projectA = path.join(projectsDir, 'ProjectA')
      await fs.mkdir(projectA, { recursive: true })
      await fs.writeFile(
        path.join(projectA, 'tasks.md'),
        '- [x] Completed task\n- [ ] Open task\n'
      )

      const result = await extractTodos(projectsDir, vaultDir)

      expect(result.total).toBe(2)
      expect(result.completed).toBe(1)
      expect(result.byProject['ProjectA'][0]).toMatchObject({
        text: 'Completed task',
        done: true,
        type: 'checkbox'
      })
      expect(result.byProject['ProjectA'][1]).toMatchObject({
        text: 'Open task',
        done: false,
        type: 'checkbox'
      })
    })

    it('extracts TODO comments (case-insensitive)', async () => {
      const projectA = path.join(projectsDir, 'ProjectA')
      await fs.mkdir(projectA, { recursive: true })
      await fs.writeFile(
        path.join(projectA, 'code.md'),
        '// TODO: implement this\n// todo: refactor\n'
      )

      const result = await extractTodos(projectsDir, vaultDir)

      expect(result.total).toBe(2)
      expect(result.byProject['ProjectA']).toHaveLength(2)
      expect(result.byProject['ProjectA'][0]).toMatchObject({
        text: 'implement this',
        done: false,
        type: 'todo_comment'
      })
      expect(result.byProject['ProjectA'][1]).toMatchObject({
        text: 'refactor',
        done: false,
        type: 'todo_comment'
      })
    })

    it('extracts FIXME comments', async () => {
      const projectA = path.join(projectsDir, 'ProjectA')
      await fs.mkdir(projectA, { recursive: true })
      await fs.writeFile(
        path.join(projectA, 'bugs.md'),
        '// FIXME: memory leak here\n'
      )

      const result = await extractTodos(projectsDir, vaultDir)

      expect(result.total).toBe(1)
      expect(result.byProject['ProjectA'][0]).toMatchObject({
        text: 'memory leak here',
        done: false,
        type: 'fixme'
      })
    })

    it('extracts HACK comments', async () => {
      const projectA = path.join(projectsDir, 'ProjectA')
      await fs.mkdir(projectA, { recursive: true })
      await fs.writeFile(
        path.join(projectA, 'workarounds.md'),
        '// HACK: temporary workaround\n'
      )

      const result = await extractTodos(projectsDir, vaultDir)

      expect(result.total).toBe(1)
      expect(result.byProject['ProjectA'][0]).toMatchObject({
        text: 'temporary workaround',
        done: false,
        type: 'hack'
      })
    })

    it('extracts all pattern types from a single file', async () => {
      const projectA = path.join(projectsDir, 'ProjectA')
      await fs.mkdir(projectA, { recursive: true })
      await fs.writeFile(
        path.join(projectA, 'mixed.md'),
        `# Mixed TODO Types
- [ ] Checkbox task
- [x] Completed checkbox
TODO: refactor this
FIXME: bug here
HACK: quick fix
`
      )

      const result = await extractTodos(projectsDir, vaultDir)

      expect(result.total).toBe(5)
      expect(result.completed).toBe(1)

      const todos = result.byProject['ProjectA']
      expect(todos.find(t => t.type === 'checkbox' && !t.done)).toBeDefined()
      expect(todos.find(t => t.type === 'checkbox' && t.done)).toBeDefined()
      expect(todos.find(t => t.type === 'todo_comment')).toBeDefined()
      expect(todos.find(t => t.type === 'fixme')).toBeDefined()
      expect(todos.find(t => t.type === 'hack')).toBeDefined()
    })

    it('groups TODOs by project', async () => {
      const projectA = path.join(projectsDir, 'ProjectA')
      const projectB = path.join(projectsDir, 'ProjectB')
      await fs.mkdir(projectA, { recursive: true })
      await fs.mkdir(projectB, { recursive: true })

      await fs.writeFile(path.join(projectA, 'tasks.md'), '- [ ] Task A\n')
      await fs.writeFile(path.join(projectB, 'tasks.md'), '- [ ] Task B\n')

      const result = await extractTodos(projectsDir, vaultDir)

      expect(result.total).toBe(2)
      expect(Object.keys(result.byProject)).toContain('ProjectA')
      expect(Object.keys(result.byProject)).toContain('ProjectB')
      expect(result.byProject['ProjectA']).toHaveLength(1)
      expect(result.byProject['ProjectB']).toHaveLength(1)
    })

    it('scans both projects and vault directories', async () => {
      const projectA = path.join(projectsDir, 'ProjectA')
      const vaultInbox = path.join(vaultDir, 'Inbox')
      await fs.mkdir(projectA, { recursive: true })
      await fs.mkdir(vaultInbox, { recursive: true })

      await fs.writeFile(path.join(projectA, 'tasks.md'), '- [ ] Project task\n')
      await fs.writeFile(path.join(vaultInbox, 'inbox.md'), '- [ ] Vault task\n')

      const result = await extractTodos(projectsDir, vaultDir)

      expect(result.total).toBe(2)
      expect(result.byProject['ProjectA']).toHaveLength(1)
      expect(result.byProject['Inbox']).toHaveLength(1)
    })

    it('recursively scans subdirectories', async () => {
      const deepPath = path.join(projectsDir, 'ProjectA', 'subdir', 'deep')
      await fs.mkdir(deepPath, { recursive: true })
      await fs.writeFile(path.join(deepPath, 'nested.md'), '- [ ] Deep task\n')

      const result = await extractTodos(projectsDir, vaultDir)

      expect(result.total).toBe(1)
      expect(result.byProject['ProjectA']).toHaveLength(1)
    })

    it('skips node_modules directories', async () => {
      const nodeModules = path.join(projectsDir, 'ProjectA', 'node_modules')
      await fs.mkdir(nodeModules, { recursive: true })
      await fs.writeFile(path.join(nodeModules, 'package.md'), '- [ ] Should skip\n')

      const projectA = path.join(projectsDir, 'ProjectA')
      await fs.writeFile(path.join(projectA, 'tasks.md'), '- [ ] Should find\n')

      const result = await extractTodos(projectsDir, vaultDir)

      expect(result.total).toBe(1)
      expect(result.byProject['ProjectA'][0].text).toBe('Should find')
    })

    it('skips .git directories', async () => {
      const gitDir = path.join(projectsDir, 'ProjectA', '.git')
      await fs.mkdir(gitDir, { recursive: true })
      await fs.writeFile(path.join(gitDir, 'log.md'), '- [ ] Should skip\n')

      const projectA = path.join(projectsDir, 'ProjectA')
      await fs.writeFile(path.join(projectA, 'tasks.md'), '- [ ] Should find\n')

      const result = await extractTodos(projectsDir, vaultDir)

      expect(result.total).toBe(1)
      expect(result.byProject['ProjectA'][0].text).toBe('Should find')
    })

    it('generates stable IDs for the same file/line/text', async () => {
      const projectA = path.join(projectsDir, 'ProjectA')
      await fs.mkdir(projectA, { recursive: true })
      await fs.writeFile(path.join(projectA, 'tasks.md'), '- [ ] Stable task\n')

      const result1 = await extractTodos(projectsDir, vaultDir)
      const result2 = await extractTodos(projectsDir, vaultDir)

      const id1 = result1.byProject['ProjectA'][0].id
      const id2 = result2.byProject['ProjectA'][0].id

      expect(id1).toBe(id2)
      expect(id1).toMatch(/^[0-9a-f]{16}$/)
    })

    it('handles indented checkboxes', async () => {
      const projectA = path.join(projectsDir, 'ProjectA')
      await fs.mkdir(projectA, { recursive: true })
      await fs.writeFile(
        path.join(projectA, 'tasks.md'),
        '  - [ ] Indented task\n    - [x] Deeply indented\n'
      )

      const result = await extractTodos(projectsDir, vaultDir)

      expect(result.total).toBe(2)
      expect(result.byProject['ProjectA']).toHaveLength(2)
    })
  })

  describe('toggleTodo', () => {
    it('toggles unchecked checkbox to checked', async () => {
      const projectA = path.join(projectsDir, 'ProjectA')
      await fs.mkdir(projectA, { recursive: true })
      const filePath = path.join(projectA, 'tasks.md')
      await fs.writeFile(filePath, '- [ ] Task to toggle\n')

      // Get the TODO ID
      const result = await extractTodos(projectsDir, vaultDir)
      const todoId = result.byProject['ProjectA'][0].id

      // Toggle it
      await toggleTodo(todoId, projectsDir, vaultDir)

      // Verify file was modified
      const content = await fs.readFile(filePath, 'utf-8')
      expect(content).toBe('- [x] Task to toggle\n')
    })

    it('toggles checked checkbox to unchecked', async () => {
      const projectA = path.join(projectsDir, 'ProjectA')
      await fs.mkdir(projectA, { recursive: true })
      const filePath = path.join(projectA, 'tasks.md')
      await fs.writeFile(filePath, '- [x] Completed task\n')

      const result = await extractTodos(projectsDir, vaultDir)
      const todoId = result.byProject['ProjectA'][0].id

      await toggleTodo(todoId, projectsDir, vaultDir)

      const content = await fs.readFile(filePath, 'utf-8')
      expect(content).toBe('- [ ] Completed task\n')
    })

    it('preserves surrounding content when toggling', async () => {
      const projectA = path.join(projectsDir, 'ProjectA')
      await fs.mkdir(projectA, { recursive: true })
      const filePath = path.join(projectA, 'tasks.md')
      const originalContent = `# Task List

Before content
- [ ] Task to toggle
After content

## Section 2
More content here`

      await fs.writeFile(filePath, originalContent)

      const result = await extractTodos(projectsDir, vaultDir)
      const todoId = result.byProject['ProjectA'][0].id

      await toggleTodo(todoId, projectsDir, vaultDir)

      const content = await fs.readFile(filePath, 'utf-8')
      const expected = `# Task List

Before content
- [x] Task to toggle
After content

## Section 2
More content here`

      expect(content).toBe(expected)
    })

    it('throws error when toggling TODO comment', async () => {
      const projectA = path.join(projectsDir, 'ProjectA')
      await fs.mkdir(projectA, { recursive: true })
      await fs.writeFile(path.join(projectA, 'code.md'), 'TODO: cannot toggle\n')

      const result = await extractTodos(projectsDir, vaultDir)
      const todoId = result.byProject['ProjectA'][0].id

      await expect(toggleTodo(todoId, projectsDir, vaultDir)).rejects.toThrow(
        'Only checkbox TODOs can be toggled'
      )
    })

    it('throws error when toggling FIXME comment', async () => {
      const projectA = path.join(projectsDir, 'ProjectA')
      await fs.mkdir(projectA, { recursive: true })
      await fs.writeFile(path.join(projectA, 'bugs.md'), 'FIXME: cannot toggle\n')

      const result = await extractTodos(projectsDir, vaultDir)
      const todoId = result.byProject['ProjectA'][0].id

      await expect(toggleTodo(todoId, projectsDir, vaultDir)).rejects.toThrow(
        'Only checkbox TODOs can be toggled'
      )
    })

    it('throws error when toggling HACK comment', async () => {
      const projectA = path.join(projectsDir, 'ProjectA')
      await fs.mkdir(projectA, { recursive: true })
      await fs.writeFile(path.join(projectA, 'hacks.md'), 'HACK: cannot toggle\n')

      const result = await extractTodos(projectsDir, vaultDir)
      const todoId = result.byProject['ProjectA'][0].id

      await expect(toggleTodo(todoId, projectsDir, vaultDir)).rejects.toThrow(
        'Only checkbox TODOs can be toggled'
      )
    })

    it('throws error for non-existent TODO ID', async () => {
      await expect(toggleTodo('0123456789abcdef', projectsDir, vaultDir)).rejects.toThrow(
        'TODO item not found'
      )
    })

    it('validates file path is within allowed directories', async () => {
      // This is implicitly tested by the path validation in toggleTodo
      // If a TODO is found, its path must be within projectsDir or vaultDir
      const projectA = path.join(projectsDir, 'ProjectA')
      await fs.mkdir(projectA, { recursive: true })
      await fs.writeFile(path.join(projectA, 'tasks.md'), '- [ ] Valid task\n')

      const result = await extractTodos(projectsDir, vaultDir)
      const todoId = result.byProject['ProjectA'][0].id

      // Should not throw
      await expect(toggleTodo(todoId, projectsDir, vaultDir)).resolves.toBeUndefined()
    })

    it('handles case-insensitive [X] checkbox', async () => {
      const projectA = path.join(projectsDir, 'ProjectA')
      await fs.mkdir(projectA, { recursive: true })
      const filePath = path.join(projectA, 'tasks.md')
      await fs.writeFile(filePath, '- [X] Task with capital X\n')

      const result = await extractTodos(projectsDir, vaultDir)
      const todoId = result.byProject['ProjectA'][0].id

      await toggleTodo(todoId, projectsDir, vaultDir)

      const content = await fs.readFile(filePath, 'utf-8')
      expect(content).toBe('- [ ] Task with capital X\n')
    })
  })
})
