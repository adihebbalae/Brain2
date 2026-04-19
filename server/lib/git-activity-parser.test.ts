import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { promises as fs } from 'node:fs'
import { execSync } from 'node:child_process'
import path from 'node:path'
import os from 'node:os'
import { getGitActivity } from './git-activity-parser.js'

describe('git-activity-parser', () => {
  let tempDir: string

  beforeEach(async () => {
    // Create a temporary directory for testing
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'cortex-git-test-'))
  })

  afterEach(async () => {
    // Clean up temporary directory
    try {
      await fs.rm(tempDir, { recursive: true, force: true })
    } catch (error) {
      console.error('Failed to clean up temp dir:', error)
    }
  })

  describe('getGitActivity', () => {
    it('should return empty data when projects directory is empty', async () => {
      const result = await getGitActivity(tempDir)

      expect(result).toEqual({
        heatmap: {},
        projects: [],
        totalCommitsLast30Days: 0,
        streak: 0
      })
    })

    it('should skip non-directory entries', async () => {
      // Create a file in the temp dir
      await fs.writeFile(path.join(tempDir, 'file.txt'), 'test')

      // Create a project directory
      const projectDir = path.join(tempDir, 'project1')
      await fs.mkdir(projectDir)

      const result = await getGitActivity(tempDir)

      expect(result.projects).toHaveLength(1)
      expect(result.projects[0].name).toBe('project1')
    })

    it('should handle projects without .git directory', async () => {
      const project1 = path.join(tempDir, 'project1')
      const project2 = path.join(tempDir, 'project2')

      await fs.mkdir(project1)
      await fs.mkdir(project2)

      // Initialize git only in project1
      execSync('git init', { cwd: project1, stdio: 'pipe' })
      execSync('git config user.email "test@test.com"', { cwd: project1, stdio: 'pipe' })
      execSync('git config user.name "Test User"', { cwd: project1, stdio: 'pipe' })

      // Create a commit
      await fs.writeFile(path.join(project1, 'test.txt'), 'test')
      execSync('git add .', { cwd: project1, stdio: 'pipe' })
      execSync('git commit -m "test commit"', { cwd: project1, stdio: 'pipe' })

      const result = await getGitActivity(tempDir)

      expect(result.projects).toHaveLength(2)

      // Find projects by name (sort order may vary)
      const proj1 = result.projects.find(p => p.name === 'project1')
      const proj2 = result.projects.find(p => p.name === 'project2')

      expect(proj1).toBeDefined()
      expect(proj1?.lastCommitDate).not.toBeNull()
      expect(proj1?.lastCommitMessage).toBe('test commit')
      expect(proj1?.commitsLast90Days).toBe(1)

      expect(proj2).toBeDefined()
      expect(proj2?.lastCommitDate).toBeNull()
      expect(proj2?.lastCommitMessage).toBeNull()
      expect(proj2?.commitsLast90Days).toBe(0)
    })

    it('should parse git log output correctly', async () => {
      const projectDir = path.join(tempDir, 'project1')
      await fs.mkdir(projectDir)

      // Initialize git
      execSync('git init', { cwd: projectDir, stdio: 'pipe' })
      execSync('git config user.email "test@test.com"', { cwd: projectDir, stdio: 'pipe' })
      execSync('git config user.name "Test User"', { cwd: projectDir, stdio: 'pipe' })

      // Create multiple commits
      await fs.writeFile(path.join(projectDir, 'file1.txt'), 'test1')
      execSync('git add .', { cwd: projectDir, stdio: 'pipe' })
      execSync('git commit -m "feat: add feature"', { cwd: projectDir, stdio: 'pipe' })

      await fs.writeFile(path.join(projectDir, 'file2.txt'), 'test2')
      execSync('git add .', { cwd: projectDir, stdio: 'pipe' })
      execSync('git commit -m "fix: bug fix"', { cwd: projectDir, stdio: 'pipe' })

      await fs.writeFile(path.join(projectDir, 'file3.txt'), 'test3')
      execSync('git add .', { cwd: projectDir, stdio: 'pipe' })
      execSync('git commit -m "docs: update docs"', { cwd: projectDir, stdio: 'pipe' })

      const result = await getGitActivity(tempDir)

      expect(result.projects[0]).toMatchObject({
        name: 'project1',
        lastCommitMessage: 'docs: update docs',
        commitsLast90Days: 3
      })
      expect(result.projects[0].lastCommitDate).not.toBeNull()
    })

    it('should build heatmap correctly', async () => {
      const projectDir = path.join(tempDir, 'project1')
      await fs.mkdir(projectDir)

      execSync('git init', { cwd: projectDir, stdio: 'pipe' })
      execSync('git config user.email "test@test.com"', { cwd: projectDir, stdio: 'pipe' })
      execSync('git config user.name "Test User"', { cwd: projectDir, stdio: 'pipe' })

      // Create commits
      await fs.writeFile(path.join(projectDir, 'file1.txt'), 'test1')
      execSync('git add .', { cwd: projectDir, stdio: 'pipe' })
      execSync('git commit -m "commit 1"', { cwd: projectDir, stdio: 'pipe' })

      await fs.writeFile(path.join(projectDir, 'file2.txt'), 'test2')
      execSync('git add .', { cwd: projectDir, stdio: 'pipe' })
      execSync('git commit -m "commit 2"', { cwd: projectDir, stdio: 'pipe' })

      const result = await getGitActivity(tempDir)

      const today = new Date().toISOString().substring(0, 10)
      expect(result.heatmap[today]).toBeGreaterThan(0)
      expect(result.totalCommitsLast30Days).toBe(2)
    })

    it('should handle commit messages with pipe characters', async () => {
      const projectDir = path.join(tempDir, 'project1')
      await fs.mkdir(projectDir)

      execSync('git init', { cwd: projectDir, stdio: 'pipe' })
      execSync('git config user.email "test@test.com"', { cwd: projectDir, stdio: 'pipe' })
      execSync('git config user.name "Test User"', { cwd: projectDir, stdio: 'pipe' })

      await fs.writeFile(path.join(projectDir, 'test.txt'), 'test')
      execSync('git add .', { cwd: projectDir, stdio: 'pipe' })
      execSync('git commit -m "feat: add feature | with pipe"', { cwd: projectDir, stdio: 'pipe' })

      const result = await getGitActivity(tempDir)

      expect(result.projects[0].lastCommitMessage).toBe('feat: add feature | with pipe')
    })

    it('should calculate streak correctly with commits today', async () => {
      const projectDir = path.join(tempDir, 'project1')
      await fs.mkdir(projectDir)

      execSync('git init', { cwd: projectDir, stdio: 'pipe' })
      execSync('git config user.email "test@test.com"', { cwd: projectDir, stdio: 'pipe' })
      execSync('git config user.name "Test User"', { cwd: projectDir, stdio: 'pipe' })

      // Create a commit today
      await fs.writeFile(path.join(projectDir, 'file1.txt'), 'test1')
      execSync('git add .', { cwd: projectDir, stdio: 'pipe' })
      execSync('git commit -m "commit today"', { cwd: projectDir, stdio: 'pipe' })

      const result = await getGitActivity(tempDir)

      // Should have at least 1 day streak since we committed today
      expect(result.streak).toBeGreaterThanOrEqual(1)
    })

    it('should sort projects by last commit date', async () => {
      const oldProject = path.join(tempDir, 'old-project')
      const newProject = path.join(tempDir, 'new-project')
      const noGitProject = path.join(tempDir, 'no-git-project')

      await fs.mkdir(oldProject)
      await fs.mkdir(newProject)
      await fs.mkdir(noGitProject)

      // Initialize old-project with a commit
      execSync('git init', { cwd: oldProject, stdio: 'pipe' })
      execSync('git config user.email "test@test.com"', { cwd: oldProject, stdio: 'pipe' })
      execSync('git config user.name "Test User"', { cwd: oldProject, stdio: 'pipe' })
      await fs.writeFile(path.join(oldProject, 'old.txt'), 'old')
      execSync('git add .', { cwd: oldProject, stdio: 'pipe' })
      execSync('git commit -m "old commit"', { cwd: oldProject, stdio: 'pipe' })

      // Wait a moment to ensure different timestamps
      await new Promise(resolve => setTimeout(resolve, 1100))

      // Initialize new-project with a more recent commit
      execSync('git init', { cwd: newProject, stdio: 'pipe' })
      execSync('git config user.email "test@test.com"', { cwd: newProject, stdio: 'pipe' })
      execSync('git config user.name "Test User"', { cwd: newProject, stdio: 'pipe' })
      await fs.writeFile(path.join(newProject, 'new.txt'), 'new')
      execSync('git add .', { cwd: newProject, stdio: 'pipe' })
      execSync('git commit -m "new commit"', { cwd: newProject, stdio: 'pipe' })

      const result = await getGitActivity(tempDir)

      // Projects with commits should come first, sorted by date desc
      expect(result.projects[0].name).toBe('new-project')
      expect(result.projects[1].name).toBe('old-project')
      expect(result.projects[2].name).toBe('no-git-project')
      expect(result.projects[2].lastCommitDate).toBeNull()
    })

    it('should skip hidden directories', async () => {
      const normalProject = path.join(tempDir, 'project1')
      const hiddenProject = path.join(tempDir, '.hidden-project')

      await fs.mkdir(normalProject)
      await fs.mkdir(hiddenProject)

      const result = await getGitActivity(tempDir)

      expect(result.projects).toHaveLength(1)
      expect(result.projects[0].name).toBe('project1')
    })
  })
})
