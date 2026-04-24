import { useState, useRef, useEffect, KeyboardEvent } from 'react'

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
  sources?: string[]
}

interface BrainChatProps {
  onClose: () => void
}

export function BrainChat({ onClose }: BrainChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [isStreaming, setIsStreaming] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Focus textarea on mount
  useEffect(() => {
    textareaRef.current?.focus()
  }, [])

  const handleSend = async () => {
    const trimmedInput = input.trim()
    if (!trimmedInput || isStreaming) return

    // Add user message
    const userMessage: ChatMessage = { role: 'user', content: trimmedInput }
    setMessages(prev => [...prev, userMessage])
    setInput('')
    setError(null)
    setIsStreaming(true)

    // Prepare conversation history for API
    const history = messages.map(msg => ({
      role: msg.role,
      content: msg.content
    }))

    try {
      // Create EventSource with POST data (we'll use fetch instead)
      // EventSource doesn't support POST, so we'll use fetch with ReadableStream
      const response = await fetch('/api/chat/query', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: trimmedInput,
          history
        })
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || `HTTP ${response.status}`)
      }

      // Create assistant message placeholder
      let assistantMessage: ChatMessage = {
        role: 'assistant',
        content: '',
        sources: []
      }

      setMessages(prev => [...prev, assistantMessage])

      // Read SSE stream
      const reader = response.body?.getReader()
      if (!reader) {
        throw new Error('Failed to read response stream')
      }

      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()

        if (done) break

        // Decode chunk and add to buffer
        buffer += decoder.decode(value, { stream: true })

        // Process complete lines
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''

        for (const line of lines) {
          if (!line.trim() || !line.startsWith('data: ')) continue

          const data = line.slice(6) // Remove 'data: ' prefix

          if (data === '[DONE]') {
            setIsStreaming(false)
            return
          }

          try {
            const parsed = JSON.parse(data)

            if (parsed.error) {
              setError(parsed.error)
              setIsStreaming(false)
              // Remove the empty assistant message
              setMessages(prev => prev.slice(0, -1))
              return
            }

            if (parsed.sources) {
              // Update sources
              setMessages(prev => {
                const updated = [...prev]
                const lastIdx = updated.length - 1
                const lastMsg = updated[lastIdx]
                if (lastMsg && lastMsg.role === 'assistant') {
                  updated[lastIdx] = { ...lastMsg, sources: parsed.sources }
                }
                return updated
              })
            }

            if (parsed.chunk) {
              // Append token to assistant message
              setMessages(prev => {
                const updated = [...prev]
                const lastIdx = updated.length - 1
                const lastMsg = updated[lastIdx]
                if (lastMsg && lastMsg.role === 'assistant') {
                  updated[lastIdx] = { ...lastMsg, content: lastMsg.content + parsed.chunk }
                }
                return updated
              })
            }
          } catch (err) {
            console.error('Failed to parse SSE data:', data, err)
          }
        }
      }

      setIsStreaming(false)
    } catch (err) {
      console.error('Chat query error:', err)
      const errorMessage = err instanceof Error ? err.message : 'Failed to send message'
      setError(errorMessage)
      setIsStreaming(false)
      // Remove the empty assistant message if present
      setMessages(prev => {
        if (prev.length > 0 && prev[prev.length - 1].role === 'assistant' && !prev[prev.length - 1].content) {
          return prev.slice(0, -1)
        }
        return prev
      })
    }
  }

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const handleClear = () => {
    setMessages([])
    setError(null)
    textareaRef.current?.focus()
  }

  return (
    <div className="fixed inset-0 bg-gray-900 bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900">Ask Cortex</h2>
          <div className="flex items-center gap-2">
            {messages.length > 0 && (
              <button
                onClick={handleClear}
                className="px-3 py-1 text-sm text-gray-600 hover:text-gray-900"
              >
                Clear
              </button>
            )}
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600"
              aria-label="Close"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Error banner */}
        {error && (
          <div className="px-4 py-3 bg-red-50 border-b border-red-200">
            <div className="flex items-start gap-2">
              <svg className="w-5 h-5 text-red-600 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div className="flex-1">
                <p className="text-sm text-red-800">{error}</p>
              </div>
              <button
                onClick={() => setError(null)}
                className="text-red-400 hover:text-red-600"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>
        )}

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.length === 0 && (
            <div className="text-center text-gray-500 mt-8">
              <p className="text-lg mb-2">Ask me anything about your notes, projects, and knowledge base.</p>
              <p className="text-sm">I'll search across all your data to help answer your questions.</p>
            </div>
          )}

          {messages.map((msg, idx) => (
            <div
              key={idx}
              className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[80%] rounded-lg px-4 py-2 ${
                  msg.role === 'user'
                    ? 'bg-blue-500 text-white'
                    : 'bg-gray-100 text-gray-900'
                }`}
              >
                <div className="whitespace-pre-wrap break-words">{msg.content}</div>

                {/* Source chips */}
                {msg.role === 'assistant' && msg.sources && msg.sources.length > 0 && (
                  <div className="mt-2 pt-2 border-t border-gray-300 flex flex-wrap gap-1">
                    <span className="text-xs text-gray-600">Sources:</span>
                    {msg.sources.map(source => (
                      <span
                        key={source}
                        className="inline-flex items-center px-2 py-0.5 text-xs bg-gray-200 text-gray-700 rounded"
                      >
                        {source}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}

          {/* Streaming indicator */}
          {isStreaming && messages.length > 0 && messages[messages.length - 1].role === 'assistant' && !messages[messages.length - 1].content && (
            <div className="flex justify-start">
              <div className="bg-gray-100 rounded-lg px-4 py-2">
                <div className="flex items-center gap-1">
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="p-4 border-t border-gray-200">
          <div className="flex gap-2">
            <textarea
              ref={textareaRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask a question... (Shift+Enter for newline, Enter to send)"
              className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              rows={2}
              disabled={isStreaming}
            />
            <button
              onClick={handleSend}
              disabled={!input.trim() || isStreaming}
              className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 disabled:bg-gray-300 disabled:cursor-not-allowed"
            >
              {isStreaming ? 'Sending...' : 'Send'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
