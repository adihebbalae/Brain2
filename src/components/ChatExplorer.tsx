import { useState } from 'react'
import { useChats, ConversationDetail } from '../hooks/useChats'

interface ChatExplorerProps {
  projectNames?: string[]
}

export function ChatExplorer({ projectNames = [] }: ChatExplorerProps) {
  const { conversations, loading, error, search, setSearch, tagConversation, getConversationDetail } = useChats()
  const [expandedConv, setExpandedConv] = useState<string | null>(null)
  const [conversationDetail, setConversationDetail] = useState<ConversationDetail | null>(null)
  const [loadingDetail, setLoadingDetail] = useState(false)
  const [editingTags, setEditingTags] = useState<string | null>(null)
  const [tagInput, setTagInput] = useState('')
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [expandedMessages, setExpandedMessages] = useState<Set<string>>(new Set())

  // Don't render if no conversations and not loading
  if (!loading && conversations.length === 0 && !search) {
    return null
  }

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

    if (diffDays === 0) return 'Today'
    if (diffDays === 1) return 'Yesterday'
    if (diffDays < 7) return `${diffDays}d ago`
    if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`
    if (diffDays < 365) return `${Math.floor(diffDays / 30)}mo ago`
    return `${Math.floor(diffDays / 365)}y ago`
  }

  const handleExpandConversation = async (uuid: string) => {
    if (expandedConv === uuid) {
      // Collapse
      setExpandedConv(null)
      setConversationDetail(null)
    } else {
      // Expand
      setExpandedConv(uuid)
      setLoadingDetail(true)
      const detail = await getConversationDetail(uuid)
      setConversationDetail(detail)
      setLoadingDetail(false)
    }
  }

  const handleTagEdit = (uuid: string, currentTags: string[]) => {
    setEditingTags(uuid)
    setTagInput(currentTags.join(', '))
  }

  const handleTagSave = async (uuid: string) => {
    const tags = tagInput
      .split(',')
      .map(t => t.trim())
      .filter(t => t.length > 0)

    try {
      await tagConversation(uuid, tags)
      setEditingTags(null)
      setTagInput('')
    } catch (err) {
      console.error('Failed to save tags:', err)
    }
  }

  const handleTagCancel = () => {
    setEditingTags(null)
    setTagInput('')
    setShowSuggestions(false)
  }

  const addTagFromSuggestion = (tag: string) => {
    const currentTags = tagInput
      .split(',')
      .map(t => t.trim())
      .filter(t => t.length > 0)

    if (!currentTags.includes(tag)) {
      currentTags.push(tag)
    }

    setTagInput(currentTags.join(', '))
    setShowSuggestions(false)
  }

  const toggleMessageExpand = (messageUuid: string) => {
    const newExpanded = new Set(expandedMessages)
    if (newExpanded.has(messageUuid)) {
      newExpanded.delete(messageUuid)
    } else {
      newExpanded.add(messageUuid)
    }
    setExpandedMessages(newExpanded)
  }

  const truncateText = (text: string, maxLength: number) => {
    if (text.length <= maxLength) return text
    return text.substring(0, maxLength)
  }

  if (loading && conversations.length === 0) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h2 className="text-xl font-semibold mb-4">Chat Exports</h2>
        <div className="space-y-2">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-20 bg-gray-200 rounded animate-pulse" />
          ))}
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h2 className="text-xl font-semibold mb-4">Chat Exports</h2>
        <div className="text-red-600 text-sm">{error}</div>
      </div>
    )
  }

  if (conversations.length === 0 && search) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h2 className="text-xl font-semibold mb-4">Chat Exports</h2>
        <div className="mb-4">
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search conversations..."
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div className="text-gray-500 text-sm text-center py-8">
          No conversations match your search
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6">
      <h2 className="text-xl font-semibold mb-4">Chat Exports ({conversations.length})</h2>

      {/* Search bar */}
      <div className="mb-4">
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search conversations..."
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {/* Conversation list */}
      <div className="space-y-3">
        {conversations.map(conv => (
          <div key={conv.uuid} className="border border-gray-200 rounded-md overflow-hidden">
            {/* Conversation header */}
            <div
              className="p-4 hover:bg-gray-50 cursor-pointer"
              onClick={() => handleExpandConversation(conv.uuid)}
            >
              <div className="flex items-start justify-between mb-2">
                <h3 className="font-medium text-gray-900 flex-1">{conv.name}</h3>
                <span className="text-xs text-gray-500 ml-2">{formatDate(conv.updatedAt)}</span>
              </div>

              <div className="text-sm text-gray-600 mb-2">
                {truncateText(conv.preview, 100)}
                {conv.preview.length > 100 && '...'}
              </div>

              <div className="flex items-center gap-2 text-xs text-gray-500">
                <span>{conv.messageCount} messages</span>
                <span>•</span>
                <span>{conv.sourceFile}</span>
              </div>

              {/* Tags */}
              <div className="mt-2 flex flex-wrap gap-2 items-center">
                {editingTags === conv.uuid ? (
                  <div className="flex-1 relative" onClick={e => e.stopPropagation()}>
                    <input
                      type="text"
                      value={tagInput}
                      onChange={e => setTagInput(e.target.value)}
                      onFocus={() => setShowSuggestions(true)}
                      onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
                      placeholder="tag1, tag2, ..."
                      className="w-full px-2 py-1 text-xs border border-blue-500 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                      autoFocus
                    />
                    {showSuggestions && projectNames.length > 0 && (
                      <div className="absolute top-full left-0 mt-1 bg-white border border-gray-300 rounded shadow-lg z-10 max-h-40 overflow-y-auto">
                        {projectNames.map(project => (
                          <div
                            key={project}
                            onClick={() => addTagFromSuggestion(project)}
                            className="px-3 py-2 text-xs hover:bg-blue-50 cursor-pointer"
                          >
                            {project}
                          </div>
                        ))}
                      </div>
                    )}
                    <div className="flex gap-2 mt-1">
                      <button
                        onClick={() => handleTagSave(conv.uuid)}
                        className="px-2 py-1 text-xs bg-blue-500 text-white rounded hover:bg-blue-600"
                      >
                        Save
                      </button>
                      <button
                        onClick={handleTagCancel}
                        className="px-2 py-1 text-xs bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    {conv.tags.length > 0 ? (
                      conv.tags.map(tag => (
                        <span
                          key={tag}
                          className="inline-flex items-center px-2 py-1 text-xs bg-blue-100 text-blue-800 rounded"
                        >
                          {tag}
                        </span>
                      ))
                    ) : null}
                    <button
                      onClick={e => {
                        e.stopPropagation()
                        handleTagEdit(conv.uuid, conv.tags)
                      }}
                      className="text-xs text-blue-600 hover:text-blue-800"
                    >
                      {conv.tags.length > 0 ? 'Edit tags' : '+ Add tags'}
                    </button>
                  </>
                )}
              </div>
            </div>

            {/* Expanded message thread */}
            {expandedConv === conv.uuid && (
              <div className="border-t border-gray-200 bg-gray-50 p-4">
                {loadingDetail ? (
                  <div className="text-sm text-gray-500">Loading messages...</div>
                ) : conversationDetail ? (
                  <div className="space-y-3">
                    {conversationDetail.messages.map(msg => {
                      const isExpanded = expandedMessages.has(msg.uuid)
                      const needsTruncation = msg.text.length > 500
                      const displayText = needsTruncation && !isExpanded
                        ? truncateText(msg.text, 500)
                        : msg.text

                      return (
                        <div
                          key={msg.uuid}
                          className={`flex ${msg.sender === 'human' ? 'justify-end' : 'justify-start'}`}
                        >
                          <div
                            className={`max-w-[80%] px-4 py-2 rounded-lg ${
                              msg.sender === 'human'
                                ? 'bg-blue-500 text-white'
                                : 'bg-white text-gray-900 border border-gray-200'
                            }`}
                          >
                            <div className="text-sm whitespace-pre-wrap break-words">
                              {displayText}
                              {needsTruncation && !isExpanded && '...'}
                            </div>
                            {needsTruncation && (
                              <button
                                onClick={() => toggleMessageExpand(msg.uuid)}
                                className={`text-xs mt-2 ${
                                  msg.sender === 'human'
                                    ? 'text-blue-100 hover:text-white'
                                    : 'text-blue-600 hover:text-blue-800'
                                }`}
                              >
                                {isExpanded ? 'Show less' : 'Show more'}
                              </button>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                ) : (
                  <div className="text-sm text-red-600">Failed to load conversation details</div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
