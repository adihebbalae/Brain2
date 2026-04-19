#!/usr/bin/env node
/**
 * Cortex MCP Server
 * Exposes Cortex backend data as tools for Claude Desktop via MCP protocol
 * Transport: stdio (for Claude Desktop compatibility)
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { registerTools } from './lib/mcp-tools.js'
import dotenv from 'dotenv'

// Load environment variables
dotenv.config()

async function main() {
  // Validate required environment variables
  if (!process.env.PROJECTS_DIR || !process.env.VAULT_DIR) {
    console.error('ERROR: PROJECTS_DIR and VAULT_DIR environment variables are required')
    process.exit(1)
  }

  // Create MCP server
  const server = new McpServer({
    name: 'cortex',
    version: '1.0.0',
  })

  // Register all 8 tools
  registerTools(server)

  // Create stdio transport
  const transport = new StdioServerTransport()

  // Connect server to transport
  await server.connect(transport)

  // Log to stderr (stdout is used for MCP protocol)
  console.error('Cortex MCP server started')
  console.error('Registered tools: list_todos, get_deadlines, list_projects, search_notes, add_capture, get_daily_context, search_wiki, get_reading_log')
}

// Run server
main().catch((error) => {
  console.error('Failed to start MCP server:', error)
  process.exit(1)
})
