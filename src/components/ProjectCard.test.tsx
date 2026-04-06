import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ProjectCard } from './ProjectCard'
import { Project } from '../types'

describe('ProjectCard', () => {
  const mockProject: Project = {
    name: 'Test Project',
    path: '/test/path',
    status: 'active',
    lastModified: new Date().toISOString(),
    staleDays: 5,
    summary: 'This is a test summary',
    nextSteps: ['Step 1', 'Step 2', 'Step 3', 'Step 4'],
    todos: 3,
    openTodos: 3,
    hasDeadlines: false,
  }

  it('renders project name', () => {
    render(<ProjectCard project={mockProject} />)
    expect(screen.getByText('Test Project')).toBeTruthy()
  })

  it('renders status badge with correct color for active status', () => {
    render(<ProjectCard project={mockProject} />)
    const statusBadge = screen.getByText('active')
    expect(statusBadge.className).toContain('bg-green-100')
    expect(statusBadge.className).toContain('text-green-800')
  })

  it('renders status badge with correct color for stale status', () => {
    const staleProject = { ...mockProject, status: 'stale' as const }
    render(<ProjectCard project={staleProject} />)
    const statusBadge = screen.getByText('stale')
    expect(statusBadge.className).toContain('bg-amber-100')
    expect(statusBadge.className).toContain('text-amber-800')
  })

  it('renders summary text', () => {
    render(<ProjectCard project={mockProject} />)
    expect(screen.getByText('This is a test summary')).toBeTruthy()
  })

  it('renders max 3 next steps', () => {
    render(<ProjectCard project={mockProject} />)
    expect(screen.getByText('Step 1')).toBeTruthy()
    expect(screen.getByText('Step 2')).toBeTruthy()
    expect(screen.getByText('Step 3')).toBeTruthy()
    expect(screen.queryByText('Step 4')).toBeNull()
  })

  it('renders TODO count badge', () => {
    render(<ProjectCard project={mockProject} />)
    expect(screen.getByText('3 TODOs')).toBeTruthy()
  })

  it('renders Open in VS Code button with correct href', () => {
    render(<ProjectCard project={mockProject} />)
    const button = screen.getByText('Open in VS Code')
    expect((button as HTMLAnchorElement).href).toBe('vscode://file//test/path')
  })

  it('applies amber border for stale projects (>14 days)', () => {
    const staleProject = { ...mockProject, staleDays: 20 }
    const { container } = render(<ProjectCard project={staleProject} />)
    const card = container.querySelector('.border-amber-400')
    expect(card).toBeTruthy()
  })

  it('applies red border for very stale projects (>30 days)', () => {
    const veryStaleProject = { ...mockProject, staleDays: 35 }
    const { container } = render(<ProjectCard project={veryStaleProject} />)
    const card = container.querySelector('.border-red-400')
    expect(card).toBeTruthy()
  })
})
