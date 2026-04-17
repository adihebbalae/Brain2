import { useState } from 'react'
import { useReading } from '../hooks/useReading'

type StatusFilter = 'all' | 'unread' | 'read'

export function ReadingPanel() {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('unread')
  const [quickAddUrl, setQuickAddUrl] = useState('')
  const [addingItem, setAddingItem] = useState(false)
  const [addMessage, setAddMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const { data, loading, error, refetch, addItem } = useReading(statusFilter)

  const handleQuickAdd = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!quickAddUrl.trim()) return

    setAddingItem(true)
    const success = await addItem(quickAddUrl.trim())

    if (success) {
      setQuickAddUrl('')
      setAddMessage({ type: 'success', text: 'Added to reading list!' })
    } else {
      setAddMessage({ type: 'error', text: 'Failed to add item' })
    }

    setAddingItem(false)

    // Auto-dismiss message after 3 seconds
    setTimeout(() => setAddMessage(null), 3000)
  }

  // Format date for display
  const formatDate = (date?: Date | string): string => {
    if (!date) return ''
    const d = typeof date === 'string' ? new Date(date) : date
    if (isNaN(d.getTime())) return ''

    const now = new Date()
    const diffMs = now.getTime() - d.getTime()
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

    if (diffDays === 0) return 'Today'
    if (diffDays === 1) return 'Yesterday'
    if (diffDays < 7) return `${diffDays}d ago`
    if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`
    if (diffDays < 365) return `${Math.floor(diffDays / 30)}mo ago`
    return `${Math.floor(diffDays / 365)}y ago`
  }

  if (loading) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h2 className="text-xl font-semibold mb-4">Reading List</h2>
        <div className="space-y-2">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-16 bg-gray-200 rounded animate-pulse" />
          ))}
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-white rounded-lg border border-red-200 p-6">
        <h2 className="text-xl font-semibold mb-4 text-red-700">Error Loading Reading List</h2>
        <p className="text-red-600 mb-4">{error}</p>
        <button
          onClick={refetch}
          className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
        >
          Retry
        </button>
      </div>
    )
  }

  if (!data) {
    return null
  }

  const { items, unread, read, total, topTopics } = data

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <h2 className="text-xl font-semibold">Reading List</h2>
          {unread > 0 && (
            <span className="px-2 py-1 bg-blue-100 text-blue-700 text-sm font-medium rounded">
              {unread} unread
            </span>
          )}
        </div>
      </div>

      {/* Status Filter Tabs */}
      <div className="flex gap-2 mb-4 border-b border-gray-200">
        <button
          onClick={() => setStatusFilter('unread')}
          className={`px-4 py-2 border-b-2 transition-colors ${
            statusFilter === 'unread'
              ? 'border-blue-600 text-blue-600 font-medium'
              : 'border-transparent text-gray-600 hover:text-gray-900'
          }`}
        >
          Unread ({unread})
        </button>
        <button
          onClick={() => setStatusFilter('all')}
          className={`px-4 py-2 border-b-2 transition-colors ${
            statusFilter === 'all'
              ? 'border-blue-600 text-blue-600 font-medium'
              : 'border-transparent text-gray-600 hover:text-gray-900'
          }`}
        >
          All ({total})
        </button>
        <button
          onClick={() => setStatusFilter('read')}
          className={`px-4 py-2 border-b-2 transition-colors ${
            statusFilter === 'read'
              ? 'border-blue-600 text-blue-600 font-medium'
              : 'border-transparent text-gray-600 hover:text-gray-900'
          }`}
        >
          Read ({read})
        </button>
      </div>

      {/* Quick Add Form */}
      <form onSubmit={handleQuickAdd} className="mb-4">
        <div className="flex gap-2">
          <input
            type="url"
            value={quickAddUrl}
            onChange={(e) => setQuickAddUrl(e.target.value)}
            placeholder="https://... — add to reading list"
            className="flex-1 px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
            disabled={addingItem}
          />
          <button
            type="submit"
            disabled={!quickAddUrl.trim() || addingItem}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
          >
            {addingItem ? 'Adding...' : 'Add'}
          </button>
        </div>
        {addMessage && (
          <div
            className={`mt-2 px-3 py-2 rounded text-sm ${
              addMessage.type === 'success'
                ? 'bg-green-100 text-green-700'
                : 'bg-red-100 text-red-700'
            }`}
          >
            {addMessage.text}
          </div>
        )}
      </form>

      {/* Reading Items */}
      {items.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          {statusFilter === 'unread' && (
            <span>No unread items — you&apos;re all caught up! 🎉</span>
          )}
          {statusFilter === 'read' && (
            <span>No read items yet</span>
          )}
          {statusFilter === 'all' && (
            <span>No items in your reading list</span>
          )}
        </div>
      ) : (
        <div className="space-y-2 mb-6 max-h-96 overflow-y-auto">
          {items.map(item => (
            <div
              key={item.id}
              className="p-3 border border-gray-200 rounded hover:bg-gray-50 transition-colors"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <a
                    href={item.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`font-medium hover:text-blue-600 ${
                      item.read ? 'text-gray-500 line-through' : 'text-gray-900'
                    }`}
                  >
                    {item.title}
                  </a>
                  <div className="flex items-center gap-2 mt-1 text-sm text-gray-500">
                    <span
                      className={`px-2 py-0.5 rounded text-xs ${
                        item.source === 'bookmarks'
                          ? 'bg-purple-100 text-purple-700'
                          : 'bg-green-100 text-green-700'
                      }`}
                    >
                      {item.source === 'bookmarks' ? 'Chrome' : 'Vault'}
                    </span>
                    {item.date && <span>{formatDate(item.date)}</span>}
                    {item.tags.length > 0 && (
                      <div className="flex gap-1">
                        {item.tags.map((tag, idx) => (
                          <span key={idx} className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded text-xs">
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Top Topics */}
      {topTopics.length > 0 && (
        <div className="border-t border-gray-200 pt-4">
          <h3 className="text-sm font-semibold text-gray-700 mb-2">Top Topics</h3>
          <div className="flex flex-wrap gap-2">
            {topTopics.map(({ topic, count }) => (
              <span
                key={topic}
                className="px-3 py-1 bg-blue-50 text-blue-700 rounded-full text-sm"
              >
                {topic} <span className="text-blue-500">{count}</span>
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
