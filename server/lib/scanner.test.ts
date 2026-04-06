import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { promises as fs } from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { scanProjects } from './scanner.js'
import { readProjectState } from './state-reader.js'

describe('Project Scanner', () => {
  let tempDir: string

  beforeEach(async () => {
    // Create a temporary directory for testing
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'cortex-test-'))
  })

  afterEach(async () => {
    // Clean up temporary directory
    try {
      await fs.rm(tempDir, { recursive: true, force: true })
    } catch (error) {
      console.error('Failed to clean up temp dir:', error)
    }
  })

  describe('State file priority detection', () => {
    it('should choose agent_state.md over state.md when both exist', async () => {
      const projectDir = path.join(tempDir, 'test-project')
      await fs.mkdir(projectDir)

      await fs.writeFile(
        path.join(projectDir, 'agent_state.md'),
        '# Agent State\n\nThis is the agent state file.'
      )
      await fs.writeFile(
        path.join(projectDir, 'state.md'),
        '# State\n\nThis is the regular state file.'
      )

      const state = await readProjectState(projectDir, tempDir)
      expect(state).not.toBeNull()
      expect(state?.stateFile).toBe('agent_state.md')
    })

    it('should fall back to state.md if agent_state.md does not exist', async () => {
      const projectDir = path.join(tempDir, 'test-project')
      await fs.mkdir(projectDir)

      await fs.writeFile(
        path.join(projectDir, 'state.md'),
        '# State\n\nThis is the regular state file.'
      )

      const state = await readProjectState(projectDir, tempDir)
      expect(state).not.toBeNull()
      expect(state?.stateFile).toBe('state.md')
    })

    it('should use README.md as last resort', async () => {
      const projectDir = path.join(tempDir, 'test-project')
      await fs.mkdir(projectDir)

      await fs.writeFile(
        path.join(projectDir, 'README.md'),
        '# Project\n\nThis is the README.'
      )

      const state = await readProjectState(projectDir, tempDir)
      expect(state).not.toBeNull()
      expect(state?.stateFile).toBe('README.md')
    })
  })

  describe('Status inference', () => {
    it('should infer blocked status from content', async () => {
      const projectDir = path.join(tempDir, 'blocked-project')
      await fs.mkdir(projectDir)

      await fs.writeFile(
        path.join(projectDir, 'state.md'),
        '# Project\n\nThis project is blocked waiting on external dependencies.'
      )

      const state = await readProjectState(projectDir, tempDir)
      expect(state?.status).toBe('blocked')
    })

    it('should infer completed status from content', async () => {
      const projectDir = path.join(tempDir, 'completed-project')
      await fs.mkdir(projectDir)

      await fs.writeFile(
        path.join(projectDir, 'state.md'),
        '# Project\n\nThis project is completed and shipped to production.'
      )

      const state = await readProjectState(projectDir, tempDir)
      expect(state?.status).toBe('completed')
    })

    it('should infer not_started status from content', async () => {
      const projectDir = path.join(tempDir, 'idea-project')
      await fs.mkdir(projectDir)

      await fs.writeFile(
        path.join(projectDir, 'state.md'),
        '# Project Idea\n\nThis is just an idea, not started yet.'
      )

      const state = await readProjectState(projectDir, tempDir)
      expect(state?.status).toBe('not_started')
    })

    it('should default to in_progress when no keywords match', async () => {
      const projectDir = path.join(tempDir, 'active-project')
      await fs.mkdir(projectDir)

      await fs.writeFile(
        path.join(projectDir, 'state.md'),
        '# Project\n\nCurrently working on features.'
      )

      const state = await readProjectState(projectDir, tempDir)
      expect(state?.status).toBe('in_progress')
    })
  })

  describe('Stale calculation', () => {
    it('should calculate staleDays correctly', async () => {
      const projectDir = path.join(tempDir, 'stale-project')
      await fs.mkdir(projectDir)

      const stateFile = path.join(projectDir, 'state.md')
      await fs.writeFile(stateFile, '# Project\n\nWorking on it.')

      // Modify the file's timestamp to 20 days ago
      const twentyDaysAgo = new Date()
      twentyDaysAgo.setDate(twentyDaysAgo.getDate() - 20)
      await fs.utimes(stateFile, twentyDaysAgo, twentyDaysAgo)

      const state = await readProjectState(projectDir, tempDir)
      expect(state?.staleDays).toBeGreaterThanOrEqual(19)
      expect(state?.staleDays).toBeLessThanOrEqual(21)
    })

    it('should mark project as stale if >14 days old and no other status', async () => {
      const projectDir = path.join(tempDir, 'stale-project')
      await fs.mkdir(projectDir)

      const stateFile = path.join(projectDir, 'state.md')
      await fs.writeFile(stateFile, '# Project\n\nWorking on it.')

      // Modify the file's timestamp to 20 days ago
      const twentyDaysAgo = new Date()
      twentyDaysAgo.setDate(twentyDaysAgo.getDate() - 20)
      await fs.utimes(stateFile, twentyDaysAgo, twentyDaysAgo)

      const state = await readProjectState(projectDir, tempDir)
      expect(state?.status).toBe('stale')
    })
  })

  describe('Summary extraction', () => {
    it('should extract summary from ## Summary section', async () => {
      const projectDir = path.join(tempDir, 'summary-project')
      await fs.mkdir(projectDir)

      await fs.writeFile(
        path.join(projectDir, 'state.md'),
        `# Project

## Summary
This is a comprehensive summary of the project. It has multiple sentences. This should be captured.

## Details
More details here.`
      )

      const state = await readProjectState(projectDir, tempDir)
      expect(state?.summary).toContain('comprehensive summary')
    })

    it('should extract summary from ## Overview section', async () => {
      const projectDir = path.join(tempDir, 'overview-project')
      await fs.mkdir(projectDir)

      await fs.writeFile(
        path.join(projectDir, 'state.md'),
        `# Project

## Overview
This is the project overview. It provides context.

## More sections
Content here.`
      )

      const state = await readProjectState(projectDir, tempDir)
      expect(state?.summary).toContain('project overview')
    })
  })

  describe('Next steps extraction', () => {
    it('should extract next steps from ## Next Steps section', async () => {
      const projectDir = path.join(tempDir, 'nextsteps-project')
      await fs.mkdir(projectDir)

      await fs.writeFile(
        path.join(projectDir, 'state.md'),
        `# Project

## Next Steps
- Implement feature A
- Write tests for B
- Deploy to production
- Update documentation
- Refactor old code

## Other
More content.`
      )

      const state = await readProjectState(projectDir, tempDir)
      expect(state?.nextSteps).toHaveLength(5)
      expect(state?.nextSteps[0]).toBe('Implement feature A')
      expect(state?.nextSteps[1]).toBe('Write tests for B')
    })

    it('should extract unchecked items as next steps', async () => {
      const projectDir = path.join(tempDir, 'checkbox-project')
      await fs.mkdir(projectDir)

      await fs.writeFile(
        path.join(projectDir, 'state.md'),
        `# Project

Some content here.

- [ ] Task one
- [ ] Task two
- [x] Already done
- [ ] Task three`
      )

      const state = await readProjectState(projectDir, tempDir)
      expect(state?.nextSteps.length).toBeGreaterThan(0)
      expect(state?.nextSteps).toContain('Task one')
    })
  })

  describe('Path validation', () => {
    it('should reject paths outside PROJECTS_DIR', async () => {
      const outsideDir = path.join(os.tmpdir(), 'outside-project')
      await fs.mkdir(outsideDir, { recursive: true })

      await fs.writeFile(
        path.join(outsideDir, 'state.md'),
        '# Malicious Project'
      )

      await expect(
        readProjectState(outsideDir, tempDir)
      ).rejects.toThrow('Invalid project path')

      // Clean up
      await fs.rm(outsideDir, { recursive: true, force: true })
    })
  })

  describe('Full scanner', () => {
    it('should scan multiple projects and sort by lastModified', async () => {
      // Create three projects with different modification times
      const project1 = path.join(tempDir, 'project-1')
      const project2 = path.join(tempDir, 'project-2')
      const project3 = path.join(tempDir, 'project-3')

      await fs.mkdir(project1)
      await fs.mkdir(project2)
      await fs.mkdir(project3)

      const file1 = path.join(project1, 'state.md')
      const file2 = path.join(project2, 'state.md')
      const file3 = path.join(project3, 'state.md')

      await fs.writeFile(file1, '# Project 1')
      await fs.writeFile(file2, '# Project 2')
      await fs.writeFile(file3, '# Project 3')

      // Set different modification times
      const now = new Date()
      const twoDaysAgo = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000)
      const fiveDaysAgo = new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000)

      await fs.utimes(file1, fiveDaysAgo, fiveDaysAgo)  // Oldest
      await fs.utimes(file2, now, now)                  // Newest
      await fs.utimes(file3, twoDaysAgo, twoDaysAgo)    // Middle

      const projects = await scanProjects(tempDir)

      expect(projects).toHaveLength(3)
      // Should be sorted by lastModified descending (newest first)
      expect(projects[0].name).toBe('project-2')
      expect(projects[1].name).toBe('project-3')
      expect(projects[2].name).toBe('project-1')
    })

    it('should skip directories without state files', async () => {
      const projectWithState = path.join(tempDir, 'project-with-state')
      const projectNoState = path.join(tempDir, 'project-no-state')

      await fs.mkdir(projectWithState)
      await fs.mkdir(projectNoState)

      await fs.writeFile(path.join(projectWithState, 'state.md'), '# Project')
      await fs.writeFile(path.join(projectNoState, 'other.txt'), 'Not a state file')

      const projects = await scanProjects(tempDir)

      expect(projects).toHaveLength(1)
      expect(projects[0].name).toBe('project-with-state')
    })

    it('should skip hidden directories', async () => {
      const normalProject = path.join(tempDir, 'normal-project')
      const hiddenProject = path.join(tempDir, '.hidden-project')

      await fs.mkdir(normalProject)
      await fs.mkdir(hiddenProject)

      await fs.writeFile(path.join(normalProject, 'state.md'), '# Normal')
      await fs.writeFile(path.join(hiddenProject, 'state.md'), '# Hidden')

      const projects = await scanProjects(tempDir)

      expect(projects).toHaveLength(1)
      expect(projects[0].name).toBe('normal-project')
    })
  })
})
