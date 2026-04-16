import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { promises as fs } from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { resolveVaultDirs, isPathInVaults } from './vault-dirs.js'
import { extractTodosMultiVault } from './todo-extractor.js'
import { readDeadlinesMultiVault } from './deadline-reader.js'

let tmpDir: string

beforeEach(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'cortex-multi-vault-'))
})

afterEach(async () => {
  await fs.rm(tmpDir, { recursive: true, force: true })
})

// --- vault-dirs.ts tests ---
describe('resolveVaultDirs', () => {
  it('returns single dir when VAULT_DIRS not set', async () => {
    const vault = path.join(tmpDir, 'vault1')
    await fs.mkdir(vault)
    const result = await resolveVaultDirs(vault)
    expect(result).toEqual([path.resolve(vault)])
  })

  it('returns multiple dirs when VAULT_DIRS is set', async () => {
    const vault1 = path.join(tmpDir, 'vault1')
    const vault2 = path.join(tmpDir, 'vault2')
    await fs.mkdir(vault1)
    await fs.mkdir(vault2)
    const result = await resolveVaultDirs(vault1, `${vault2}`)
    expect(result).toHaveLength(2)
    expect(result[0]).toBe(path.resolve(vault1))
    expect(result[1]).toBe(path.resolve(vault2))
  })

  it('deduplicates identical paths', async () => {
    const vault1 = path.join(tmpDir, 'vault1')
    await fs.mkdir(vault1)
    const result = await resolveVaultDirs(vault1, vault1)
    expect(result).toHaveLength(1)
  })

  it('skips non-existent directories with warning', async () => {
    const vault1 = path.join(tmpDir, 'vault1')
    const missing = path.join(tmpDir, 'does-not-exist')
    await fs.mkdir(vault1)
    const result = await resolveVaultDirs(vault1, missing)
    expect(result).toHaveLength(1)
    expect(result[0]).toBe(path.resolve(vault1))
  })

  it('skips empty VAULT_DIRS entries', async () => {
    const vault1 = path.join(tmpDir, 'vault1')
    await fs.mkdir(vault1)
    const result = await resolveVaultDirs(vault1, ',,,')
    expect(result).toHaveLength(1)
  })
})

describe('isPathInVaults', () => {
  it('returns true for path inside one of the vaults', () => {
    const v1 = path.resolve(tmpDir, 'vault1')
    const v2 = path.resolve(tmpDir, 'vault2')
    const vaults = [v1, v2]
    expect(isPathInVaults(path.join(v1, 'test.md'), vaults)).toBe(true)
    expect(isPathInVaults(path.join(v2, 'sub', 'file.md'), vaults)).toBe(true)
  })

  it('returns false for path outside all vaults', () => {
    const v1 = path.resolve(tmpDir, 'vault1')
    const v2 = path.resolve(tmpDir, 'vault2')
    const vaults = [v1, v2]
    expect(isPathInVaults(path.join(tmpDir, 'other', 'file.md'), vaults)).toBe(false)
  })
})

// --- Multi-vault todo extraction test ---
describe('extractTodosMultiVault', () => {
  it('extracts todos from multiple vault directories', async () => {
    const projectsDir = path.join(tmpDir, 'projects')
    const vault1 = path.join(tmpDir, 'vault1')
    const vault2 = path.join(tmpDir, 'vault2')

    // Create projects dir with a todo
    await fs.mkdir(path.join(projectsDir, 'MyProject'), { recursive: true })
    await fs.writeFile(
      path.join(projectsDir, 'MyProject', 'notes.md'),
      '- [ ] Project todo item\n'
    )

    // Create vault1 with a todo
    await fs.mkdir(path.join(vault1, 'Inbox'), { recursive: true })
    await fs.writeFile(
      path.join(vault1, 'Inbox', 'inbox.md'),
      '- [ ] Vault1 todo item\n'
    )

    // Create vault2 with a todo
    await fs.mkdir(path.join(vault2, 'Notes'), { recursive: true })
    await fs.writeFile(
      path.join(vault2, 'Notes', 'ideas.md'),
      '- [ ] Vault2 todo item\n- [x] Vault2 done item\n'
    )

    const result = await extractTodosMultiVault(projectsDir, [vault1, vault2])
    expect(result.total).toBe(4)
    expect(result.completed).toBe(1)

    const allTodos = Object.values(result.byProject).flat()
    const texts = allTodos.map(t => t.text)
    expect(texts).toContain('Project todo item')
    expect(texts).toContain('Vault1 todo item')
    expect(texts).toContain('Vault2 todo item')
    expect(texts).toContain('Vault2 done item')
  })

  it('handles empty vault dirs array', async () => {
    const projectsDir = path.join(tmpDir, 'projects')
    await fs.mkdir(projectsDir, { recursive: true })
    const result = await extractTodosMultiVault(projectsDir, [])
    expect(result.total).toBe(0)
  })
})

// --- Multi-vault deadline extraction test ---
describe('readDeadlinesMultiVault', () => {
  it('merges deadlines from multiple vault directories', async () => {
    const vault1 = path.join(tmpDir, 'vault1')
    const vault2 = path.join(tmpDir, 'vault2')

    await fs.mkdir(path.join(vault1, 'Deadlines'), { recursive: true })
    await fs.writeFile(
      path.join(vault1, 'Deadlines', 'deadlines.md'),
      '# Deadlines\n- [ ] 2030-01-15 | Vault1 deadline | school\n'
    )

    await fs.mkdir(path.join(vault2, 'Deadlines'), { recursive: true })
    await fs.writeFile(
      path.join(vault2, 'Deadlines', 'deadlines.md'),
      '# Deadlines\n- [ ] 2030-02-20 | Vault2 deadline | personal\n'
    )

    const deadlines = await readDeadlinesMultiVault([vault1, vault2])
    expect(deadlines).toHaveLength(2)
    const descriptions = deadlines.map(d => d.description)
    expect(descriptions).toContain('Vault1 deadline')
    expect(descriptions).toContain('Vault2 deadline')
  })

  it('deduplicates identical deadlines across vaults', async () => {
    const vault1 = path.join(tmpDir, 'vault1')
    const vault2 = path.join(tmpDir, 'vault2')

    const content = '# Deadlines\n- [ ] 2030-01-15 | Same deadline | school\n'
    await fs.mkdir(path.join(vault1, 'Deadlines'), { recursive: true })
    await fs.writeFile(path.join(vault1, 'Deadlines', 'deadlines.md'), content)
    await fs.mkdir(path.join(vault2, 'Deadlines'), { recursive: true })
    await fs.writeFile(path.join(vault2, 'Deadlines', 'deadlines.md'), content)

    const deadlines = await readDeadlinesMultiVault([vault1, vault2])
    expect(deadlines).toHaveLength(1) // deduplicated
  })

  it('handles vault without deadlines.md gracefully', async () => {
    const vault1 = path.join(tmpDir, 'vault1')
    await fs.mkdir(vault1, { recursive: true })
    // No Deadlines/ directory

    const deadlines = await readDeadlinesMultiVault([vault1])
    expect(deadlines).toHaveLength(0)
  })
})
