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
  account: string
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
  accounts: string[]
  activeAccount: string | null
  setActiveAccount: (account: string | null) => void
}

export function useChats(): UseChatsReturn {
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearchValue] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [activeAccount, setActiveAccountValue] = useState<string | null>(null)
  const [accounts, setAccounts] = useState<string[]>([])

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

      // Build URL with optional account filter
      let url = debouncedSearch
        ? `/api/chats/search?q=${encodeURIComponent(debouncedSearch)}`
        : '/api/chats'

      if (activeAccount) {
        url += (debouncedSearch ? '&' : '?') + `account=${encodeURIComponent(activeAccount)}`
      }

      const response = await fetch(url)

      if (!response.ok) {
        throw new Error(`Failed to fetch conversations: ${response.statusText}`)
      }

      const data = (await response.json()) as Conversation[]
      setConversations(data)

      // Derive unique accounts from loaded conversations
      const uniqueAccounts = Array.from(new Set(data.map(c => c.account)))
        .sort((a, b) => {
          // Sort with "default" first, then alphabetically
          if (a === 'default') return -1
          if (b === 'default') return 1
          return a.localeCompare(b)
        })
      setAccounts(uniqueAccounts)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load conversations')
    } finally {
      setLoading(false)
    }
  }, [debouncedSearch, activeAccount])

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

  const setActiveAccount = useCallback((account: string | null) => {
    setActiveAccountValue(account)
  }, [])

  return {
    conversations,
    loading,
    error,
    search,
    setSearch,
    tagConversation,
    refetch: fetchConversations,
    getConversationDetail,
    accounts,
    activeAccount,
    setActiveAccount
  }
}
