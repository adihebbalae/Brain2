import { useState } from 'react'
import { useCanvases } from '../hooks/useCanvases'
import { useConfig } from '../hooks/useConfig'

export function CanvasPanel() {
  const { canvases, loading, error, addNode } = useCanvases()
  const { vaultName } = useConfig()
  const [addNodeText, setAddNodeText] = useState<Record<string, string>>({})
  const [addingNode, setAddingNode] = useState<Record<string, boolean>>({})
  const [addMessage, setAddMessage] = useState<{ filename: string; type: 'success' | 'error'; text: string } | null>(null)

  const handleAddNode = async (filename: string) => {
    const text = addNodeText[filename]?.trim()
    if (!text) return

    setAddingNode({ ...addingNode, [filename]: true })
    const success = await addNode(filename, text)

    if (success) {
      setAddNodeText({ ...addNodeText, [filename]: '' })
      setAddMessage({ filename, type: 'success', text: 'Node added!' })
    } else {
      setAddMessage({ filename, type: 'error', text: 'Failed to add node' })
    }

    setAddingNode({ ...addingNode, [filename]: false })

    // Auto-dismiss message after 2 seconds
    setTimeout(() => setAddMessage(null), 2000)
  }

  const openInObsidian = (filePath: string) => {
    // Construct Obsidian deep link
    const url = `obsidian://open?vault=${encodeURIComponent(vaultName)}&file=${encodeURIComponent(filePath)}`
    window.open(url, '_blank')
  }

  if (loading) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h2 className="text-xl font-semibold mb-4">Canvases</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[1, 2].map(i => (
            <div key={i} className="h-48 bg-gray-200 rounded animate-pulse" />
          ))}
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-white rounded-lg border border-red-200 p-6">
        <h2 className="text-xl font-semibold mb-4 text-red-700">Error Loading Canvases</h2>
        <p className="text-red-600">{error}</p>
      </div>
    )
  }

  if (canvases.length === 0) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h2 className="text-xl font-semibold mb-4">Canvases</h2>
        <p className="text-gray-500">No canvas files found in vault</p>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6">
      {/* Header */}
      <div className="flex items-center gap-3 mb-4">
        <h2 className="text-xl font-semibold">Canvases</h2>
        <span className="px-2 py-1 bg-purple-100 text-purple-700 text-sm font-medium rounded">
          {canvases.length}
        </span>
      </div>

      {/* Canvas Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {canvases.map(canvas => (
          <div key={canvas.filePath} className="border border-gray-200 rounded-lg p-4 hover:border-purple-300 transition-colors">
            {/* Canvas Name */}
            <h3 className="font-medium text-gray-900 mb-2">{canvas.filename}</h3>

            {/* Stats */}
            <div className="text-sm text-gray-600 mb-3">
              {canvas.nodeCount} nodes · {canvas.edgeCount} edges
            </div>

            {/* Text Preview Chips */}
            {canvas.textPreview.length > 0 && (
              <div className="mb-3 space-y-1">
                {canvas.textPreview.slice(0, 3).map((text, idx) => (
                  <div key={idx} className="bg-gray-700 text-gray-100 rounded px-2 py-1 text-xs truncate" title={text}>
                    {text.substring(0, 40)}{text.length > 40 ? '...' : ''}
                  </div>
                ))}
              </div>
            )}

            {/* Referenced Files */}
            {canvas.fileNodes.length > 0 && (
              <div className="mb-3">
                <div className="text-xs text-gray-500 mb-1">Referenced files:</div>
                <div className="flex flex-wrap gap-1">
                  {canvas.fileNodes.slice(0, 3).map((file, idx) => (
                    <span key={idx} className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded">
                      {file.split('/').pop()}
                    </span>
                  ))}
                  {canvas.fileNodes.length > 3 && (
                    <span className="text-xs text-gray-500">+{canvas.fileNodes.length - 3} more</span>
                  )}
                </div>
              </div>
            )}

            {/* Open in Obsidian Button */}
            <button
              onClick={() => openInObsidian(canvas.filePath)}
              className="w-full px-3 py-1.5 bg-purple-600 text-white text-sm rounded hover:bg-purple-700 transition-colors mb-2"
            >
              Open in Obsidian
            </button>

            {/* Add Node Form */}
            <div className="pt-2 border-t border-gray-200">
              <div className="text-xs text-gray-600 mb-1">Add node:</div>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={addNodeText[canvas.filename] || ''}
                  onChange={(e) => setAddNodeText({ ...addNodeText, [canvas.filename]: e.target.value })}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !addingNode[canvas.filename]) {
                      handleAddNode(canvas.filename)
                    }
                  }}
                  placeholder="Node text..."
                  className="flex-1 px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-purple-500"
                  disabled={addingNode[canvas.filename]}
                />
                <button
                  onClick={() => handleAddNode(canvas.filename)}
                  disabled={!addNodeText[canvas.filename]?.trim() || addingNode[canvas.filename]}
                  className="px-3 py-1 bg-green-600 text-white text-sm rounded hover:bg-green-700 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed"
                >
                  {addingNode[canvas.filename] ? '...' : 'Add'}
                </button>
              </div>

              {/* Success/Error Message */}
              {addMessage && addMessage.filename === canvas.filename && (
                <div className={`mt-2 text-xs ${addMessage.type === 'success' ? 'text-green-600' : 'text-red-600'}`}>
                  {addMessage.text}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
