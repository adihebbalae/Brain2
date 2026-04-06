import { useState, useMemo, useEffect } from 'react'
import { useTodos } from '../hooks/useTodos'
import { Todo } from '../types'

interface TodoAggregatorProps {
  onCountChange?: (openCount: number) => void
}

type GroupBy = 'project' | 'file'

export function TodoAggregator({ onCountChange }: TodoAggregatorProps) {
  const { todos, loading, error, toggle, refetch } = useTodos()
  const [groupBy, setGroupBy] = useState<GroupBy>('project')
  const [showCompleted, setShowCompleted] = useState(false)
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set())
  const [toastMessage, setToastMessage] = useState<string | null>(null)

  // Listen for error events from useTodos
  useEffect(() => {
    const handleError = (e: Event) => {
      const customEvent = e as CustomEvent<{ message: string }>
      setToastMessage(customEvent.detail.message)
      setTimeout(() => setToastMessage(null), 3000)
    }

    window.addEventListener('todo-error', handleError)
    return () => window.removeEventListener('todo-error', handleError)
  }, [])

  // Split todos into open and completed
  const openTodos = useMemo(() => todos.filter(t => !t.done), [todos])
  const completedTodos = useMemo(() => todos.filter(t => t.done), [todos])

  // Notify parent of count changes
  useEffect(() => {
    onCountChange?.(openTodos.length)
  }, [openTodos.length, onCountChange])

  // Group todos by selected key
  const groupedOpen = useMemo(() => {
    const groups: Record<string, Todo[]> = {}
    openTodos.forEach(todo => {
      const key = groupBy === 'project' ? todo.project : todo.file
      if (!groups[key]) groups[key] = []
      groups[key].push(todo)
    })

    // Sort groups alphabetically
    return Object.keys(groups)
      .sort()
      .reduce((acc, key) => {
        acc[key] = groups[key]
        return acc
      }, {} as Record<string, Todo[]>)
  }, [openTodos, groupBy])

  const groupedCompleted = useMemo(() => {
    const groups: Record<string, Todo[]> = {}
    completedTodos.forEach(todo => {
      const key = groupBy === 'project' ? todo.project : todo.file
      if (!groups[key]) groups[key] = []
      groups[key].push(todo)
    })

    return Object.keys(groups)
      .sort()
      .reduce((acc, key) => {
        acc[key] = groups[key]
        return acc
      }, {} as Record<string, Todo[]>)
  }, [completedTodos, groupBy])

  const toggleGroup = (groupName: string) => {
    const newCollapsed = new Set(collapsedGroups)
    if (newCollapsed.has(groupName)) {
      newCollapsed.delete(groupName)
    } else {
      newCollapsed.add(groupName)
    }
    setCollapsedGroups(newCollapsed)
  }

  const truncateFilePath = (file: string) => {
    const parts = file.split(/[/\\]/)
    if (parts.length <= 2) return file
    return `.../${parts.slice(-2).join('/')}`
  }

  if (loading) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h2 className="text-xl font-semibold mb-4">TODOs</h2>
        <div className="space-y-2">
          {[1, 2, 3, 4, 5].map(i => (
            <div key={i} className="h-10 bg-gray-200 rounded animate-pulse" />
          ))}
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-white rounded-lg border border-red-200 p-6">
        <h2 className="text-xl font-semibold mb-4 text-red-700">Error Loading TODOs</h2>
        <p className="text-red-600 mb-4">{error}</p>
        <button
          onClick={refetch}
          className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition-colors"
        >
          Retry
        </button>
      </div>
    )
  }

  if (openTodos.length === 0 && completedTodos.length === 0) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h2 className="text-xl font-semibold mb-4">TODOs</h2>
        <p className="text-gray-500 text-center py-8">
          No open TODOs — you're all caught up! 🎉
        </p>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6">
      {/* Header with grouping toggle */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold">TODOs</h2>
        <div className="flex gap-2">
          <button
            onClick={() => setGroupBy('project')}
            className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
              groupBy === 'project'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            By project
          </button>
          <button
            onClick={() => setGroupBy('file')}
            className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
              groupBy === 'file'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            By file
          </button>
        </div>
      </div>

      {/* Open todos */}
      <div className="space-y-4">
        {Object.entries(groupedOpen).map(([groupName, groupTodos]) => {
          const isCollapsed = collapsedGroups.has(groupName)

          return (
            <div key={groupName} className="border-b border-gray-100 pb-4 last:border-b-0">
              {/* Group header */}
              <button
                onClick={() => toggleGroup(groupName)}
                className="flex items-center justify-between w-full text-left mb-2 hover:bg-gray-50 px-2 py-1 rounded transition-colors"
              >
                <div className="flex items-center gap-2">
                  <span className="text-gray-400">
                    {isCollapsed ? '▶' : '▼'}
                  </span>
                  <span className="font-medium text-gray-900">{groupName}</span>
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                    {groupTodos.length}
                  </span>
                </div>
              </button>

              {/* Group todos */}
              {!isCollapsed && (
                <div className="space-y-2 ml-6">
                  {groupTodos.map(todo => (
                    <div key={todo.id} className="flex items-start gap-3 py-1">
                      <input
                        type="checkbox"
                        checked={todo.done}
                        onChange={() => toggle(todo.id)}
                        className="mt-1 h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                      />
                      <div className="flex-1 min-w-0">
                        <span className={todo.done ? 'line-through text-gray-500' : 'text-gray-900'}>
                          {todo.text}
                        </span>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-mono bg-gray-100 text-gray-600">
                            {truncateFilePath(todo.file)}:{todo.line}
                          </span>
                          {(todo.type === 'FIXME' || todo.type === 'HACK') && (
                            <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                              todo.type === 'FIXME'
                                ? 'bg-orange-100 text-orange-800'
                                : 'bg-red-100 text-red-800'
                            }`}>
                              {todo.type}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Completed todos */}
      {completedTodos.length > 0 && (
        <div className="mt-6 pt-6 border-t border-gray-200">
          <button
            onClick={() => setShowCompleted(!showCompleted)}
            className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900 transition-colors"
          >
            <span className="text-gray-400">
              {showCompleted ? '▼' : '▶'}
            </span>
            Show completed ({completedTodos.length})
          </button>

          {showCompleted && (
            <div className="mt-4 space-y-4">
              {Object.entries(groupedCompleted).map(([groupName, groupTodos]) => (
                <div key={groupName} className="ml-6">
                  <div className="font-medium text-sm text-gray-500 mb-2">{groupName}</div>
                  <div className="space-y-2 ml-4">
                    {groupTodos.map(todo => (
                      <div key={todo.id} className="flex items-start gap-3 py-1">
                        <input
                          type="checkbox"
                          checked={todo.done}
                          onChange={() => toggle(todo.id)}
                          className="mt-1 h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                        />
                        <div className="flex-1 min-w-0">
                          <span className="line-through text-gray-500">{todo.text}</span>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-mono bg-gray-100 text-gray-500">
                              {truncateFilePath(todo.file)}:{todo.line}
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Toast notification */}
      {toastMessage && (
        <div className="fixed bottom-4 left-4 bg-red-600 text-white px-4 py-3 rounded shadow-lg transition-opacity duration-300 animate-fade-in">
          {toastMessage}
        </div>
      )}
    </div>
  )
}
