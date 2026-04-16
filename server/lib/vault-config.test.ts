import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { promises as fs } from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { getVaultDirs, isPathInVault, getPrimaryVaultDir } from './vault-config.js'

let tmpDir: string
let originalEnv: NodeJS.ProcessEnv

beforeEach(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'cortex-vault-config-'))
  originalEnv = { ...process.env }
})

afterEach(async () => {
  await fs.rm(tmpDir, { recursive: true, force: true })
  process.env = originalEnv
})

describe('getVaultDirs', () => {
  it('returns single vault dir when VAULT_DIRS not set', async () => {
    const vault = path.join(tmpDir, 'vault1')
    await fs.mkdir(vault)
    process.env.VAULT_DIR = vault
    delete process.env.VAULT_DIRS

    const result = await getVaultDirs()
    expect(result).toEqual([path.resolve(vault)])
  })

  it('returns multiple vault dirs when VAULT_DIRS is set', async () => {
    const vault1 = path.join(tmpDir, 'vault1')
    const vault2 = path.join(tmpDir, 'vault2')
    await fs.mkdir(vault1)
    await fs.mkdir(vault2)

    process.env.VAULT_DIR = vault1
    process.env.VAULT_DIRS = vault2

    const result = await getVaultDirs()
    expect(result).toHaveLength(2)
    expect(result[0]).toBe(path.resolve(vault1))
    expect(result[1]).toBe(path.resolve(vault2))
  })

  it('handles comma-separated VAULT_DIRS', async () => {
    const vault1 = path.join(tmpDir, 'vault1')
    const vault2 = path.join(tmpDir, 'vault2')
    const vault3 = path.join(tmpDir, 'vault3')
    await fs.mkdir(vault1)
    await fs.mkdir(vault2)
    await fs.mkdir(vault3)

    process.env.VAULT_DIR = vault1
    process.env.VAULT_DIRS = `${vault2}, ${vault3}`

    const result = await getVaultDirs()
    expect(result).toHaveLength(3)
    expect(result[0]).toBe(path.resolve(vault1))
    expect(result[1]).toBe(path.resolve(vault2))
    expect(result[2]).toBe(path.resolve(vault3))
  })

  it('deduplicates identical paths', async () => {
    const vault1 = path.join(tmpDir, 'vault1')
    await fs.mkdir(vault1)

    process.env.VAULT_DIR = vault1
    process.env.VAULT_DIRS = vault1

    const result = await getVaultDirs()
    expect(result).toHaveLength(1)
    expect(result[0]).toBe(path.resolve(vault1))
  })

  it('includes non-existent directories with warning', async () => {
    const vault1 = path.join(tmpDir, 'vault1')
    const missing = path.join(tmpDir, 'does-not-exist')
    await fs.mkdir(vault1)

    const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

    process.env.VAULT_DIR = vault1
    process.env.VAULT_DIRS = missing

    const result = await getVaultDirs()
    expect(result).toHaveLength(2)
    expect(result[0]).toBe(path.resolve(vault1))
    expect(result[1]).toBe(path.resolve(missing))
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('Including non-existent directory')
    )

    consoleSpy.mockRestore()
  })

  it('skips non-absolute paths with warning', async () => {
    const vault1 = path.join(tmpDir, 'vault1')
    await fs.mkdir(vault1)

    const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

    process.env.VAULT_DIR = vault1
    process.env.VAULT_DIRS = 'relative/path'

    const result = await getVaultDirs()
    expect(result).toHaveLength(1)
    expect(result[0]).toBe(path.resolve(vault1))
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('Skipping non-absolute path')
    )

    consoleSpy.mockRestore()
  })

  it('skips empty VAULT_DIRS entries', async () => {
    const vault1 = path.join(tmpDir, 'vault1')
    await fs.mkdir(vault1)

    process.env.VAULT_DIR = vault1
    process.env.VAULT_DIRS = '  ,  ,  '

    const result = await getVaultDirs()
    expect(result).toHaveLength(1)
    expect(result[0]).toBe(path.resolve(vault1))
  })

  it('throws error when VAULT_DIR not set', async () => {
    delete process.env.VAULT_DIR

    await expect(getVaultDirs()).rejects.toThrow('VAULT_DIR environment variable is required')
  })

  it('skips non-directory files with warning', async () => {
    const vault1 = path.join(tmpDir, 'vault1')
    const file = path.join(tmpDir, 'file.txt')
    await fs.mkdir(vault1)
    await fs.writeFile(file, 'not a directory')

    const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

    process.env.VAULT_DIR = vault1
    process.env.VAULT_DIRS = file

    const result = await getVaultDirs()
    expect(result).toHaveLength(1)
    expect(result[0]).toBe(path.resolve(vault1))
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('Skipping non-directory')
    )

    consoleSpy.mockRestore()
  })
})

describe('isPathInVault', () => {
  it('returns true for path inside vault dir', async () => {
    const vault = path.join(tmpDir, 'vault1')
    await fs.mkdir(vault)

    process.env.VAULT_DIR = vault
    delete process.env.VAULT_DIRS

    const testFile = path.join(vault, 'test.md')
    const result = await isPathInVault(testFile)
    expect(result).toBe(true)
  })

  it('returns true for path inside any configured vault', async () => {
    const vault1 = path.join(tmpDir, 'vault1')
    const vault2 = path.join(tmpDir, 'vault2')
    await fs.mkdir(vault1)
    await fs.mkdir(vault2)

    process.env.VAULT_DIR = vault1
    process.env.VAULT_DIRS = vault2

    const testFile1 = path.join(vault1, 'test.md')
    const testFile2 = path.join(vault2, 'sub', 'test.md')

    expect(await isPathInVault(testFile1)).toBe(true)
    expect(await isPathInVault(testFile2)).toBe(true)
  })

  it('returns false for path outside all vaults', async () => {
    const vault1 = path.join(tmpDir, 'vault1')
    await fs.mkdir(vault1)

    process.env.VAULT_DIR = vault1
    delete process.env.VAULT_DIRS

    const outsideFile = path.join(tmpDir, 'outside', 'test.md')
    const result = await isPathInVault(outsideFile)
    expect(result).toBe(false)
  })

  it('returns true for path equal to vault dir', async () => {
    const vault = path.join(tmpDir, 'vault1')
    await fs.mkdir(vault)

    process.env.VAULT_DIR = vault
    delete process.env.VAULT_DIRS

    const result = await isPathInVault(vault)
    expect(result).toBe(true)
  })
})

describe('getPrimaryVaultDir', () => {
  it('returns VAULT_DIR path', async () => {
    const vault = path.join(tmpDir, 'vault1')
    await fs.mkdir(vault)

    process.env.VAULT_DIR = vault

    const result = getPrimaryVaultDir()
    expect(result).toBe(path.resolve(vault))
  })

  it('returns resolved absolute path', async () => {
    const vault = path.join(tmpDir, 'vault1')
    await fs.mkdir(vault)

    process.env.VAULT_DIR = vault

    const result = getPrimaryVaultDir()
    expect(path.isAbsolute(result)).toBe(true)
    expect(result).toBe(path.resolve(vault))
  })

  it('throws error when VAULT_DIR not set', () => {
    delete process.env.VAULT_DIR

    expect(() => getPrimaryVaultDir()).toThrow('VAULT_DIR environment variable is required')
  })

  it('returns primary vault even when VAULT_DIRS is set', async () => {
    const vault1 = path.join(tmpDir, 'vault1')
    const vault2 = path.join(tmpDir, 'vault2')
    await fs.mkdir(vault1)
    await fs.mkdir(vault2)

    process.env.VAULT_DIR = vault1
    process.env.VAULT_DIRS = vault2

    const result = getPrimaryVaultDir()
    expect(result).toBe(path.resolve(vault1))
  })
})
