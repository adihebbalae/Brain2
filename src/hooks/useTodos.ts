import { useState, useEffect, useCallback } from 'react'
import { Todo } from '../types'

interface UseTodosReturn {
  todos: Todo[]
  loading: boolean
  error: string | null
  toggle: (id: string) => void
  refetch: () => void
}

export function useTodos(): UseTodosReturn {
  const [todos, setTodos] = useState<Todo[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchTodos = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const response = await fetch('/api/todos')

      if (!response.ok) {
        throw new Error(`Failed to fetch todos: ${response.statusText}`)
      }

      const data = await response.json()
      setTodos(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load todos')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchTodos()
  }, [fetchTodos])

  const toggle = useCallback(async (id: string) => {
    // Find the todo to toggle
    const todoIndex = todos.findIndex(t => t.id === id)
    if (todoIndex === -1) return

    const oldTodo = todos[todoIndex]
    const newDone = !oldTodo.done

    // Optimistic update: immediately update local state
    const updatedTodos = [...todos]
    updatedTodos[todoIndex] = { ...oldTodo, done: newDone }
    setTodos(updatedTodos)

    try {
      // Send PATCH request in background
      const response = await fetch(`/api/todos/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ done: newDone })
      })

      if (!response.ok) {
        throw new Error('Failed to update todo')
      }

      const result = await response.json()
      if (!result.success) {
        throw new Error(result.error || 'Failed to update todo')
      }
    } catch (err) {
      // Rollback on error
      setTodos(todos)

      // Show error toast by dispatching custom event
      window.dispatchEvent(
        new CustomEvent('todo-error', {
          detail: { message: 'Failed to save — reverted' }
        })
      )
    }
  }, [todos])

  return {
    todos,
    loading,
    error,
    toggle,
    refetch: fetchTodos
  }
}
