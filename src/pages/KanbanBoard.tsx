import { useState, useEffect, useMemo } from 'react'
import { Todo } from '../types'

interface KanbanData {
  todo: Todo[]
  doing: Todo[]
  done: Todo[]
}

type ColumnType = 'todo' | 'doing' | 'done'

const API_BASE = 'http://localhost:3001'

export function KanbanBoard() {
  const [kanbanData, setKanbanData] = useState<KanbanData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [dragOver, setDragOver] = useState<ColumnType | null>(null)
  const [selectedProject, setSelectedProject] = useState<string>('all')

  const fetchKanbanData = async () => {
    try {
      const response = await fetch(`${API_BASE}/api/kanban`)
      if (!response.ok) {
        throw new Error('Failed to fetch kanban data')
      }
      const data: KanbanData = await response.json()
      setKanbanData(data)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchKanbanData()
  }, [])

  const updateTodoStatus = async (todoId: string, newStatus: ColumnType) => {
    try {
      const response = await fetch(`${API_BASE}/api/todos/${todoId}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status: newStatus }),
      })

      if (!response.ok) {
        throw new Error('Failed to update todo status')
      }

      // Refetch data after successful update
      await fetchKanbanData()
    } catch (err) {
      console.error('Failed to update todo:', err)
      alert('Failed to update todo status')
    }
  }

  const handleDragStart = (e: React.DragEvent, todoId: string) => {
    e.dataTransfer.setData('todoId', todoId)
    e.dataTransfer.effectAllowed = 'move'
  }

  const handleDragOver = (e: React.DragEvent, column: ColumnType) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    setDragOver(column)
  }

  const handleDragLeave = () => {
    setDragOver(null)
  }

  const handleDrop = async (e: React.DragEvent, targetColumn: ColumnType) => {
    e.preventDefault()
    setDragOver(null)

    const todoId = e.dataTransfer.getData('todoId')
    if (!todoId) return

    await updateTodoStatus(todoId, targetColumn)
  }

  // Get unique projects for filter
  const projects = useMemo(() => {
    if (!kanbanData) return []
    const allTodos = [...kanbanData.todo, ...kanbanData.doing, ...kanbanData.done]
    const uniqueProjects = Array.from(new Set(allTodos.map(t => t.project)))
    return uniqueProjects.sort()
  }, [kanbanData])

  // Filter todos by project
  const filteredData = useMemo(() => {
    if (!kanbanData || selectedProject === 'all') return kanbanData

    return {
      todo: kanbanData.todo.filter(t => t.project === selectedProject),
      doing: kanbanData.doing.filter(t => t.project === selectedProject),
      done: kanbanData.done.filter(t => t.project === selectedProject),
    }
  }, [kanbanData, selectedProject])

  const getProjectColor = (project: string): string => {
    // Generate a consistent color for each project
    const hash = project.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0)
    const colors = [
      'bg-blue-100 text-blue-800',
      'bg-green-100 text-green-800',
      'bg-purple-100 text-purple-800',
      'bg-pink-100 text-pink-800',
      'bg-yellow-100 text-yellow-800',
      'bg-indigo-100 text-indigo-800',
      'bg-red-100 text-red-800',
      'bg-orange-100 text-orange-800',
    ]
    return colors[hash % colors.length]
  }

  const renderCard = (todo: Todo) => (
    <div
      key={todo.id}
      draggable
      onDragStart={(e) => handleDragStart(e, todo.id)}
      className="bg-white p-3 rounded-lg shadow-sm border border-gray-200 cursor-move hover:shadow-md transition-shadow"
    >
      <p className="text-sm text-gray-900 mb-2 line-clamp-2">{todo.text}</p>
      <div className="flex items-center gap-2 flex-wrap">
        <span className={`text-xs px-2 py-1 rounded-full font-medium ${getProjectColor(todo.project)}`}>
          {todo.project}
        </span>
        <span className="text-xs text-gray-500 truncate" title={todo.file}>
          {todo.file.split(/[/\\]/).pop()}
        </span>
      </div>
    </div>
  )

  const renderColumn = (title: string, columnType: ColumnType, todos: Todo[], icon: string) => (
    <div className="flex-1 min-w-0">
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 h-full flex flex-col">
        <div className="px-4 py-3 border-b border-gray-200 flex items-center gap-2">
          <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={icon} />
          </svg>
          <h2 className="font-semibold text-gray-900">{title}</h2>
          <span className="ml-auto text-sm text-gray-500">{todos.length}</span>
        </div>
        <div
          onDragOver={(e) => handleDragOver(e, columnType)}
          onDragLeave={handleDragLeave}
          onDrop={(e) => handleDrop(e, columnType)}
          className={`flex-1 p-4 space-y-3 overflow-y-auto transition-colors ${
            dragOver === columnType ? 'bg-blue-50' : ''
          }`}
          style={{ minHeight: '400px', maxHeight: 'calc(100vh - 300px)' }}
        >
          {todos.length === 0 ? (
            <p className="text-sm text-gray-400 text-center mt-8">No items</p>
          ) : (
            todos.map(renderCard)
          )}
        </div>
      </div>
    </div>
  )

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="text-center py-12">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <p className="mt-4 text-gray-600">Loading kanban board...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-800">Error: {error}</p>
        </div>
      </div>
    )
  }

  if (!filteredData) {
    return null
  }

  return (
    <div className="max-w-7xl mx-auto px-6 py-8">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Kanban Board</h1>
          <p className="text-sm text-gray-600 mt-1">
            Drag cards between columns to update their status
          </p>
        </div>

        {/* Project Filter */}
        {projects.length > 0 && (
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium text-gray-700">Filter by project:</label>
            <select
              value={selectedProject}
              onChange={(e) => setSelectedProject(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="all">All Projects ({projects.length})</option>
              {projects.map((project) => (
                <option key={project} value={project}>
                  {project}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Kanban Columns */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {renderColumn(
          'To Do',
          'todo',
          filteredData.todo,
          'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2'
        )}
        {renderColumn(
          'In Progress',
          'doing',
          filteredData.doing,
          'M13 10V3L4 14h7v7l9-11h-7z'
        )}
        {renderColumn(
          'Done',
          'done',
          filteredData.done,
          'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z'
        )}
      </div>
    </div>
  )
}
