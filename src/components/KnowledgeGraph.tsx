import { useEffect, useRef, useState, useMemo } from 'react'
import * as d3 from 'd3'
import { useKnowledgeGraph, type GraphNode, type GraphEdge } from '../hooks/useKnowledgeGraph'

// Color mapping for PARA folders
const FOLDER_COLORS: Record<string, string> = {
  inbox: '#64748b',      // slate
  projects: '#3b82f6',   // blue
  areas: '#22c55e',      // green
  resources: '#f59e0b',  // amber
  archive: '#6b7280',    // gray
  wiki: '#a855f7',       // purple
  dailynotes: '#ec4899', // pink
  other: '#9ca3af'       // light gray
}

// Get vault name from vault path
function getVaultName(): string {
  // This would ideally come from the backend, but for now we'll use 'SecondBrain'
  // In the future, this could be derived from VAULT_DIR basename
  return 'SecondBrain'
}

interface D3Node extends GraphNode {
  x?: number
  y?: number
  vx?: number
  vy?: number
  fx?: number | null
  fy?: number | null
}

interface D3Edge extends Omit<GraphEdge, 'source' | 'target'> {
  source: string | D3Node
  target: string | D3Node
}

export function KnowledgeGraph() {
  const [limit, setLimit] = useState(200)
  const [selectedFolders, setSelectedFolders] = useState<Set<string>>(new Set(Object.keys(FOLDER_COLORS)))
  const svgRef = useRef<SVGSVGElement>(null)
  const tooltipRef = useRef<HTMLDivElement>(null)
  const { data, loading, error } = useKnowledgeGraph(limit)

  // Filter nodes and edges by selected folders
  const filteredData = useMemo(() => {
    if (!data) return null

    const filteredNodes = data.nodes.filter(node => selectedFolders.has(node.folder))
    const nodeIds = new Set(filteredNodes.map(n => n.id))
    const filteredEdges = data.edges.filter(
      edge => nodeIds.has(edge.source) && nodeIds.has(edge.target)
    )

    return { nodes: filteredNodes, edges: filteredEdges }
  }, [data, selectedFolders])

  // Toggle folder filter
  const toggleFolder = (folder: string) => {
    setSelectedFolders(prev => {
      const next = new Set(prev)
      if (next.has(folder)) {
        next.delete(folder)
      } else {
        next.add(folder)
      }
      return next
    })
  }

  useEffect(() => {
    if (!filteredData || !svgRef.current) return

    const svg = d3.select(svgRef.current)
    const width = svgRef.current.clientWidth
    const height = svgRef.current.clientHeight

    // Clear previous content
    svg.selectAll('*').remove()

    // Create container group
    const container = svg.append('g')

    // Add zoom behavior
    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.1, 4])
      .on('zoom', (event) => {
        container.attr('transform', event.transform)
      })

    svg.call(zoom)

    // Create copies of data for D3
    const nodes: D3Node[] = filteredData.nodes.map(d => ({ ...d }))
    const edges: D3Edge[] = filteredData.edges.map(d => ({ ...d }))

    // Create simulation
    const simulation = d3.forceSimulation<D3Node>(nodes)
      .force('link', d3.forceLink<D3Node, D3Edge>(edges)
        .id(d => d.id)
        .distance(50))
      .force('charge', d3.forceManyBody().strength(-100))
      .force('center', d3.forceCenter(width / 2, height / 2))
      .force('collide', d3.forceCollide().radius(15))

    // Draw edges
    const link = container.append('g')
      .selectAll('line')
      .data(edges)
      .join('line')
      .attr('stroke', '#94a3b8')
      .attr('stroke-opacity', 0.3)
      .attr('stroke-width', 1)

    // Draw nodes
    const node = container.append('g')
      .selectAll('circle')
      .data(nodes)
      .join('circle')
      .attr('r', d => 4 + Math.min(d.linkCount * 1.5, 12))
      .attr('fill', d => FOLDER_COLORS[d.folder] || FOLDER_COLORS.other)
      .attr('stroke', '#fff')
      .attr('stroke-width', 1.5)
      .style('cursor', 'pointer')
      .on('click', (_event, d) => {
        const vaultName = getVaultName()
        const obsidianUrl = `obsidian://open?vault=${encodeURIComponent(vaultName)}&file=${encodeURIComponent(d.filePath)}`
        window.open(obsidianUrl, '_blank')
      })
      .on('mouseover', (event, d) => {
        if (tooltipRef.current) {
          const tooltip = d3.select(tooltipRef.current)
          tooltip
            .style('opacity', 1)
            .style('left', `${event.pageX + 10}px`)
            .style('top', `${event.pageY - 10}px`)
            .html(`<strong>${d.label}</strong><br/>Links: ${d.linkCount}<br/>Folder: ${d.folder}`)
        }
      })
      .on('mouseout', () => {
        if (tooltipRef.current) {
          d3.select(tooltipRef.current).style('opacity', 0)
        }
      })

    // Apply drag separately to avoid D3 generic type mismatch on .join() selections
    const dragBehavior = d3.drag<SVGCircleElement, D3Node>()
      .on('start', (event, d) => {
        if (!event.active) simulation.alphaTarget(0.3).restart()
        d.fx = d.x
        d.fy = d.y
      })
      .on('drag', (event, d) => {
        d.fx = event.x
        d.fy = event.y
      })
      .on('end', (event, d) => {
        if (!event.active) simulation.alphaTarget(0)
        d.fx = null
        d.fy = null
      })
    ;(node as unknown as d3.Selection<SVGCircleElement, D3Node, SVGGElement, unknown>)
      .call(dragBehavior)

    // Draw labels (only for nodes with linkCount > 2)
    const label = container.append('g')
      .selectAll('text')
      .data(nodes.filter(d => d.linkCount > 2))
      .join('text')
      .text(d => d.label)
      .attr('font-size', 10)
      .attr('dx', 12)
      .attr('dy', 4)
      .attr('fill', '#1f2937')
      .style('pointer-events', 'none')
      .style('user-select', 'none')

    // Update positions on tick
    simulation.on('tick', () => {
      link
        .attr('x1', d => (d.source as D3Node).x ?? 0)
        .attr('y1', d => (d.source as D3Node).y ?? 0)
        .attr('x2', d => (d.target as D3Node).x ?? 0)
        .attr('y2', d => (d.target as D3Node).y ?? 0)

      node
        .attr('cx', d => d.x ?? 0)
        .attr('cy', d => d.y ?? 0)

      label
        .attr('x', d => d.x ?? 0)
        .attr('y', d => d.y ?? 0)
    })

    // Limit simulation ticks to 300
    let ticks = 0
    const maxTicks = 300
    const tickInterval = setInterval(() => {
      ticks++
      if (ticks >= maxTicks) {
        simulation.stop()
        clearInterval(tickInterval)
      }
    }, 0)

    return () => {
      simulation.stop()
      clearInterval(tickInterval)
    }
  }, [filteredData])

  if (loading) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Knowledge Graph</h2>
        <div className="flex items-center justify-center h-96">
          <div className="text-gray-500">Loading graph...</div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Knowledge Graph</h2>
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-sm text-red-700">{error}</p>
        </div>
      </div>
    )
  }

  if (!data || data.nodes.length === 0) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Knowledge Graph</h2>
        <div className="text-center py-12 text-gray-500">
          <p>No notes with wikilinks found.</p>
          <p className="text-sm mt-2">Add [[wikilinks]] to your markdown notes to see connections.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-gray-900">Knowledge Graph</h2>
        <span className="text-sm text-gray-600">
          {filteredData?.nodes.length || 0} of {data.totalNotes} notes
        </span>
      </div>

      {/* Controls */}
      <div className="mb-4 space-y-3">
        {/* Limit slider */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Node limit: {limit}
          </label>
          <input
            type="range"
            min="50"
            max="500"
            step="50"
            value={limit}
            onChange={(e) => setLimit(parseInt(e.target.value, 10))}
            className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
          />
        </div>

        {/* Folder filters */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Filter by folder:
          </label>
          <div className="flex flex-wrap gap-2">
            {Object.entries(FOLDER_COLORS).map(([folder, color]) => {
              const count = data.nodes.filter(n => n.folder === folder).length
              if (count === 0) return null

              return (
                <button
                  key={folder}
                  onClick={() => toggleFolder(folder)}
                  className={`px-3 py-1 rounded-full text-xs font-medium transition-all ${
                    selectedFolders.has(folder)
                      ? 'text-white'
                      : 'text-gray-400 opacity-50'
                  }`}
                  style={{
                    backgroundColor: selectedFolders.has(folder) ? color : '#e5e7eb'
                  }}
                >
                  {folder} ({count})
                </button>
              )
            })}
          </div>
        </div>
      </div>

      {/* Graph */}
      <div className="relative border border-gray-200 rounded-lg overflow-hidden bg-gray-50">
        <svg
          ref={svgRef}
          width="100%"
          height="600"
          style={{ display: 'block' }}
        />

        {/* Tooltip */}
        <div
          ref={tooltipRef}
          className="absolute pointer-events-none bg-gray-900 text-white text-xs rounded px-2 py-1 opacity-0 transition-opacity"
          style={{ zIndex: 10 }}
        />
      </div>

      {/* Legend */}
      <div className="mt-4 pt-4 border-t border-gray-200">
        <div className="flex flex-wrap gap-3">
          {Object.entries(FOLDER_COLORS).map(([folder, color]) => {
            const count = data.nodes.filter(n => n.folder === folder).length
            if (count === 0) return null

            return (
              <div key={folder} className="flex items-center gap-2">
                <div
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: color }}
                />
                <span className="text-xs text-gray-600 capitalize">{folder}</span>
              </div>
            )
          })}
        </div>
        <p className="text-xs text-gray-500 mt-2">
          Click nodes to open in Obsidian • Drag to reposition • Scroll to zoom
        </p>
      </div>
    </div>
  )
}
