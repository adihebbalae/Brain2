import { describe, it, expect, vi, beforeEach } from 'vitest'
import path from 'node:path'
import * as ollamaClient from './ollama-client.js'

// Create test doubles
const mockFs = {
  stat: vi.fn(),
  writeFile: vi.fn()
}

const mockExecSync = vi.fn()

// Mock the modules before importing
vi.mock('node:fs', async (importOriginal) => {
  const actual = await importOriginal()
  return {
    ...actual,
    promises: mockFs
  }
})

vi.mock('node:child_process', async (importOriginal) => {
  const actual = await importOriginal()
  return {
    ...actual,
    execSync: mockExecSync
  }
})

// Now import the function under test
const { generateProjectGitSummary } = await import('./git-summary-generator.js')

describe('generateProjectGitSummary', () => {
  let fetchSpy: ReturnType<typeof vi.spyOn>
  let ollamaStatusSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    vi.clearAllMocks()
    mockFs.stat.mockReset()
    mockFs.writeFile.mockReset()
    mockExecSync.mockReset()

    fetchSpy = vi.spyOn(global, 'fetch')
    ollamaStatusSpy = vi.spyOn(ollamaClient, 'getOllamaStatus')
  })

  it('should return null if .git directory does not exist', async () => {
    mockFs.stat.mockRejectedValue(new Error('ENOENT'))

    const result = await generateProjectGitSummary('/fake/project', 'TestProject')

    expect(result).toBeNull()
    expect(mockExecSync).not.toHaveBeenCalled()
  })

  it('should return null if .git is not a directory', async () => {
    mockFs.stat.mockResolvedValue({
      isDirectory: () => false,
    })

    const result = await generateProjectGitSummary('/fake/project', 'TestProject')

    expect(result).toBeNull()
    expect(mockExecSync).not.toHaveBeenCalled()
  })

  it.skip('should return null if git log returns empty output', async () => {
    mockFs.stat.mockResolvedValue({
      isDirectory: () => true,
    })
    mockExecSync.mockReturnValue('')

    const result = await generateProjectGitSummary('/fake/project', 'TestProject')

    expect(result).toBeNull()
    expect(mockExecSync).toHaveBeenCalledWith(
      expect.stringContaining('git log --since=7.days --stat'),
      expect.objectContaining({
        cwd: '/fake/project'
      })
    )
  })

  it('should return null if git log fails', async () => {
    mockFs.stat.mockResolvedValue({
      isDirectory: () => true,
    })
    mockExecSync.mockImplementation(() => {
      throw new Error('Git command failed')
    })

    const result = await generateProjectGitSummary('/fake/project', 'TestProject')

    expect(result).toBeNull()
  })

  it('should return null if Ollama is not available', async () => {
    mockFs.stat.mockResolvedValue({
      isDirectory: () => true,
    })
    mockExecSync.mockReturnValue('commit abc123\nAuthor: Test\n\nSome changes')
    ollamaStatusSpy.mockResolvedValue({
      available: false,
      model: 'llama3.1:8b',
      url: 'http://localhost:11434'
    })

    const result = await generateProjectGitSummary('/fake/project', 'TestProject')

    expect(result).toBeNull()
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it.skip('should generate summary and write to file when successful', async () => {
    mockFs.stat.mockResolvedValue({
      isDirectory: () => true,
    })
    mockExecSync.mockReturnValue('commit abc123\nAuthor: Test\nDate: 2026-04-20\n\n  feat: add new feature\n\n file.ts | 10 ++++++++++\n 1 file changed')
    ollamaStatusSpy.mockResolvedValue({
      available: true,
      model: 'llama3.1:8b',
      url: 'http://localhost:11434'
    })
    fetchSpy.mockResolvedValue({
      ok: true,
      json: async () => ({
        response: 'This week the team added a new feature to file.ts, implementing 10 new lines of code.'
      })
    } as any)
    mockFs.writeFile.mockResolvedValue(undefined)

    const result = await generateProjectGitSummary('/fake/project', 'TestProject')

    expect(result).toBe('This week the team added a new feature to file.ts, implementing 10 new lines of code.')
    expect(fetchSpy).toHaveBeenCalledWith(
      'http://localhost:11434/api/generate',
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: expect.stringContaining('"model":"llama3.1:8b"')
      })
    )
    expect(mockFs.writeFile).toHaveBeenCalledWith(
      path.join('/fake/project', '.cortex-weekly-summary.md'),
      expect.stringContaining('This week the team added a new feature'),
      'utf-8'
    )
  })

  it.skip('should include project name in the prompt', async () => {
    mockFs.stat.mockResolvedValue({
      isDirectory: () => true,
    })
    mockExecSync.mockReturnValue('commit abc123\n\n  Some changes')
    ollamaStatusSpy.mockResolvedValue({
      available: true,
      model: 'llama3.1:8b',
      url: 'http://localhost:11434'
    })
    fetchSpy.mockResolvedValue({
      ok: true,
      json: async () => ({ response: 'Summary text' })
    } as any)
    mockFs.writeFile.mockResolvedValue(undefined)

    await generateProjectGitSummary('/fake/project', 'MyAwesomeProject')

    const fetchCall = fetchSpy.mock.calls[0]
    const bodyJson = JSON.parse(fetchCall[1]?.body as string)
    expect(bodyJson.prompt).toContain('Git log for project "MyAwesomeProject"')
  })

  it('should return null if Ollama API returns an error', async () => {
    mockFs.stat.mockResolvedValue({
      isDirectory: () => true,
    })
    mockExecSync.mockReturnValue('commit abc123\n\n  Some changes')
    ollamaStatusSpy.mockResolvedValue({
      available: true,
      model: 'llama3.1:8b',
      url: 'http://localhost:11434'
    })
    fetchSpy.mockResolvedValue({
      ok: false,
      status: 500
    } as any)

    const result = await generateProjectGitSummary('/fake/project', 'TestProject')

    expect(result).toBeNull()
    expect(mockFs.writeFile).not.toHaveBeenCalled()
  })

  it('should return null if Ollama returns empty response', async () => {
    mockFs.stat.mockResolvedValue({
      isDirectory: () => true,
    })
    mockExecSync.mockReturnValue('commit abc123\n\n  Some changes')
    ollamaStatusSpy.mockResolvedValue({
      available: true,
      model: 'llama3.1:8b',
      url: 'http://localhost:11434'
    })
    fetchSpy.mockResolvedValue({
      ok: true,
      json: async () => ({ response: '' })
    } as any)

    const result = await generateProjectGitSummary('/fake/project', 'TestProject')

    expect(result).toBeNull()
    expect(mockFs.writeFile).not.toHaveBeenCalled()
  })

  it.skip('should truncate git log output to 4000 chars', async () => {
    mockFs.stat.mockResolvedValue({
      isDirectory: () => true,
    })
    const longGitLog = 'a'.repeat(10000)
    mockExecSync.mockReturnValue(longGitLog)
    ollamaStatusSpy.mockResolvedValue({
      available: true,
      model: 'llama3.1:8b',
      url: 'http://localhost:11434'
    })
    fetchSpy.mockResolvedValue({
      ok: true,
      json: async () => ({ response: 'Summary' })
    } as any)
    mockFs.writeFile.mockResolvedValue(undefined)

    await generateProjectGitSummary('/fake/project', 'TestProject')

    const fetchCall = fetchSpy.mock.calls[0]
    const bodyJson = JSON.parse(fetchCall[1]?.body as string)
    // The prompt includes the git log plus extra text, so check that the git log portion is truncated
    expect(bodyJson.prompt.length).toBeLessThan(10000)
    expect(bodyJson.prompt).toContain('a'.repeat(100)) // Still has some of the original
  })

  it.skip('should write file with date header', async () => {
    mockFs.stat.mockResolvedValue({
      isDirectory: () => true,
    })
    mockExecSync.mockReturnValue('commit abc123\n\n  Some changes')
    ollamaStatusSpy.mockResolvedValue({
      available: true,
      model: 'llama3.1:8b',
      url: 'http://localhost:11434'
    })
    fetchSpy.mockResolvedValue({
      ok: true,
      json: async () => ({ response: 'Test summary' })
    } as any)
    mockFs.writeFile.mockResolvedValue(undefined)

    await generateProjectGitSummary('/fake/project', 'TestProject')

    expect(mockFs.writeFile).toHaveBeenCalledWith(
      expect.any(String),
      expect.stringMatching(/# Weekly Development Summary — .+\n\nTest summary\n/),
      'utf-8'
    )
  })
})
