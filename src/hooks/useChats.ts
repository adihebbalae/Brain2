import { useState, useEffect, useCallback } from 'react'

export interface ChatMessage {
  uuid: string
  sender: 'human' | 'assistant'
  text: string
  createdAt: string
}

export interface Conversation {
  uuid: string
  name: string
  createdAt: string
  updatedAt: string
  messageCount: number
  preview: string
  tags: string[]
  sourceFile: string
}

export interface ConversationDetail extends Conversation {
  messages: ChatMessage[]
}

interface UseChatsReturn {
  conversations: Conversation[]
  loading: boolean
  error: string | null
  search: string
  setSearch: (query: string) => void
  tagConversation: (uuid: string, tags: string[]) => Promise<void>
  refetch: () => void
  getConversationDetail: (uuid: string) => Promise<ConversationDetail | null>
}

export function useChats(): UseChatsReturn {
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearchValue] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')

  // Debounce search input (300ms)
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      setDebouncedSearch(search)
    }, 300)

    return () => clearTimeout(timeoutId)
  }, [search])

  const fetchConversations = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)

      const url = debouncedSearch
        ? `/api/chats/search?q=${encodeURIComponent(debouncedSearch)}`
        : '/api/chats'

      const response = await fetch(url)

      if (!response.ok) {
        throw new Error(`Failed to fetch conversations: ${response.statusText}`)
      }

      const data = await response.json()
      setConversations(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load conversations')
    } finally {
      setLoading(false)
    }
  }, [debouncedSearch])

  useEffect(() => {
    fetchConversations()
    // Poll every 60 seconds
    const intervalId = setInterval(fetchConversations, 60_000)
    return () => clearInterval(intervalId)
  }, [fetchConversations])

  const setSearch = useCallback((query: string) => {
    setSearchValue(query)
  }, [])

  const tagConversation = useCallback(async (uuid: string, tags: string[]) => {
    try {
      const response = await fetch(`/api/chats/${uuid}/tags`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tags })
      })

      if (!response.ok) {
        throw new Error('Failed to update tags')
      }

      // Update local state optimistically
      setConversations(prev =>
        prev.map(conv =>
          conv.uuid === uuid ? { ...conv, tags } : conv
        )
      )
    } catch (err) {
      throw new Error(err instanceof Error ? err.message : 'Failed to update tags')
    }
  }, [])

  const getConversationDetail = useCallback(async (uuid: string): Promise<ConversationDetail | null> => {
    try {
      const response = await fetch(`/api/chats/${uuid}`)

      if (response.status === 404) {
        return null
      }

      if (!response.ok) {
        throw new Error('Failed to fetch conversation detail')
      }

      const data = await response.json()
      return data as ConversationDetail
    } catch (err) {
      console.error('Error fetching conversation detail:', err)
      return null
    }
  }, [])

  return {
    conversations,
    loading,
    error,
    search,
    setSearch,
    tagConversation,
    refetch: fetchConversations,
    getConversationDetail
  }
}
