import { promises as fs } from 'node:fs'
import path from 'node:path'
import os from 'node:os'

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
  preview: string        // first human message, truncated to 200 chars
  tags: string[]
  sourceFile: string     // filename only, not full path
  account: string        // account name: "default" for top-level files, subfolder name otherwise
}

export interface ConversationDetail extends Conversation {
  messages: ChatMessage[]
}

interface RawChatMessage {
  uuid: string
  sender: 'human' | 'assistant'
  text: string
  created_at: string
}

interface RawConversation {
  uuid: string
  name: string
  created_at: string
  updated_at: string
  chat_messages: RawChatMessage[]
}

interface TagsMap {
  [uuid: string]: string[]
}

/**
 * Validate that a path is within the chat exports directory
 */
function validatePath(filePath: string, chatExportsDir: string): boolean {
  const resolved = path.resolve(filePath)
  const resolvedChatExports = path.resolve(chatExportsDir)

  const relative = path.relative(resolvedChatExports, resolved)
  return !relative.startsWith('..') && !path.isAbsolute(relative)
}

/**
 * Load tags from .tags.json sidecar file
 */
async function loadTags(chatExportsDir: string): Promise<TagsMap> {
  const tagsPath = path.join(chatExportsDir, '.tags.json')

  if (!validatePath(tagsPath, chatExportsDir)) {
    throw new Error('Invalid tags path')
  }

  try {
    await fs.access(tagsPath)
    const content = await fs.readFile(tagsPath, 'utf-8')
    return JSON.parse(content) as TagsMap
  } catch {
    // Return empty map if file doesn't exist
    return {}
  }
}

/**
 * Save tags to .tags.json sidecar file (atomic write)
 */
async function saveTags(chatExportsDir: string, tags: TagsMap): Promise<void> {
  const tagsPath = path.join(chatExportsDir, '.tags.json')

  if (!validatePath(tagsPath, chatExportsDir)) {
    throw new Error('Invalid tags path')
  }

  // Atomic write: write to temp file, then rename
  const tempPath = path.join(os.tmpdir(), `.tags-${Date.now()}.json`)
  await fs.writeFile(tempPath, JSON.stringify(tags, null, 2), 'utf-8')
  await fs.rename(tempPath, tagsPath)
}

/**
 * Convert raw conversation to Conversation interface (without messages)
 */
function rawToConversation(
  raw: RawConversation,
  sourceFile: string,
  tags: string[],
  account: string
): Conversation {
  const firstHumanMessage = raw.chat_messages.find(m => m.sender === 'human')
  const preview = firstHumanMessage
    ? firstHumanMessage.text.substring(0, 200)
    : '(No messages)'

  return {
    uuid: raw.uuid,
    name: raw.name,
    createdAt: raw.created_at,
    updatedAt: raw.updated_at,
    messageCount: raw.chat_messages.length,
    preview,
    tags,
    sourceFile,
    account
  }
}

/**
 * Convert raw conversation to ConversationDetail (with messages)
 */
function rawToConversationDetail(
  raw: RawConversation,
  sourceFile: string,
  tags: string[],
  account: string
): ConversationDetail {
  const base = rawToConversation(raw, sourceFile, tags, account)
  const messages: ChatMessage[] = raw.chat_messages.map(m => ({
    uuid: m.uuid,
    sender: m.sender,
    text: m.text,
    createdAt: m.created_at
  }))

  return {
    ...base,
    messages
  }
}

/**
 * Scan ChatExports directory recursively (one level deep) and return file paths with account labels
 */
async function scanChatExports(chatExportsDir: string): Promise<Array<{ filePath: string; account: string; fileName: string }>> {
  const results: Array<{ filePath: string; account: string; fileName: string }> = []

  try {
    const entries = await fs.readdir(chatExportsDir, { withFileTypes: true })

    // First, scan top-level JSON files → account: "default"
    for (const entry of entries) {
      if (entry.isFile() && entry.name.endsWith('.json') && entry.name !== '.tags.json') {
        const filePath = path.join(chatExportsDir, entry.name)

        // Path traversal protection
        if (!validatePath(filePath, chatExportsDir)) {
          continue
        }

        results.push({ filePath, account: 'default', fileName: entry.name })
      }
    }

    // Then, scan one level of subdirectories → account: subfolder name
    for (const entry of entries) {
      if (entry.isDirectory()) {
        const accountName = entry.name
        const subDir = path.join(chatExportsDir, accountName)

        // Path traversal protection for subdirectory
        if (!validatePath(subDir, chatExportsDir)) {
          continue
        }

        try {
          const subEntries = await fs.readdir(subDir)

          for (const file of subEntries) {
            if (file.endsWith('.json') && file !== '.tags.json') {
              const filePath = path.join(subDir, file)

              // Path traversal protection for file
              if (!validatePath(filePath, chatExportsDir)) {
                continue
              }

              results.push({ filePath, account: accountName, fileName: file })
            }
          }
        } catch (err) {
          // Skip subdirectories that can't be read
          console.error(`Failed to read subdirectory ${accountName}:`, err)
          continue
        }
      }
    }
  } catch (err) {
    // Directory doesn't exist or can't be read
    return []
  }

  return results
}

/**
 * List all conversations from ChatExports directory
 */
export async function listConversations(vaultDir: string, account?: string): Promise<Conversation[]> {
  const chatExportsDir = path.join(vaultDir, 'ChatExports')

  // Validate path
  if (!validatePath(chatExportsDir, vaultDir)) {
    throw new Error('Invalid chat exports path')
  }

  // Load tags
  const tagsMap = await loadTags(chatExportsDir)

  // Scan directory recursively for JSON files
  const fileEntries = await scanChatExports(chatExportsDir)

  // Filter by account if specified
  const filteredEntries = account
    ? fileEntries.filter(entry => entry.account === account)
    : fileEntries

  // Parse all conversations from all files
  const conversations: Conversation[] = []
  for (const entry of filteredEntries) {
    try {
      const content = await fs.readFile(entry.filePath, 'utf-8')
      const rawConversations = JSON.parse(content) as RawConversation[]

      for (const raw of rawConversations) {
        const tags = tagsMap[raw.uuid] || []
        conversations.push(rawToConversation(raw, entry.fileName, tags, entry.account))
      }
    } catch (err) {
      console.error(`Failed to parse ${entry.filePath}:`, err)
      // Skip malformed files
      continue
    }
  }

  // Sort by updatedAt descending
  conversations.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))

  return conversations
}

/**
 * Get a single conversation by UUID with full messages
 */
export async function getConversation(
  vaultDir: string,
  uuid: string
): Promise<ConversationDetail | null> {
  const chatExportsDir = path.join(vaultDir, 'ChatExports')

  // Validate path
  if (!validatePath(chatExportsDir, vaultDir)) {
    throw new Error('Invalid chat exports path')
  }

  // Validate UUID format (basic validation to prevent path traversal)
  if (!/^[a-z0-9-]+$/i.test(uuid) || uuid.includes('..') || uuid.includes('/') || uuid.includes('\\')) {
    throw new Error('Invalid conversation UUID')
  }

  // Load tags
  const tagsMap = await loadTags(chatExportsDir)

  // Scan all files recursively to find the conversation
  const fileEntries = await scanChatExports(chatExportsDir)

  for (const entry of fileEntries) {
    try {
      const content = await fs.readFile(entry.filePath, 'utf-8')
      const rawConversations = JSON.parse(content) as RawConversation[]

      const found = rawConversations.find(c => c.uuid === uuid)
      if (found) {
        const tags = tagsMap[uuid] || []
        return rawToConversationDetail(found, entry.fileName, tags, entry.account)
      }
    } catch (err) {
      console.error(`Failed to parse ${entry.filePath}:`, err)
      continue
    }
  }

  return null
}

/**
 * Search conversations by query (case-insensitive, matches name and message text)
 */
export async function searchConversations(
  vaultDir: string,
  query: string,
  account?: string
): Promise<Conversation[]> {
  const chatExportsDir = path.join(vaultDir, 'ChatExports')

  // Validate path
  if (!validatePath(chatExportsDir, vaultDir)) {
    throw new Error('Invalid chat exports path')
  }

  if (!query.trim()) {
    return listConversations(vaultDir, account)
  }

  const lowerQuery = query.toLowerCase()

  // Load tags
  const tagsMap = await loadTags(chatExportsDir)

  // Scan all files recursively
  const fileEntries = await scanChatExports(chatExportsDir)

  // Filter by account if specified
  const filteredEntries = account
    ? fileEntries.filter(entry => entry.account === account)
    : fileEntries

  // Parse and search
  const results: Array<{ conversation: Conversation; score: number }> = []

  for (const entry of filteredEntries) {
    try {
      const content = await fs.readFile(entry.filePath, 'utf-8')
      const rawConversations = JSON.parse(content) as RawConversation[]

      for (const raw of rawConversations) {
        let score = 0

        // Match in conversation name (higher score)
        if (raw.name.toLowerCase().includes(lowerQuery)) {
          score += 10
        }

        // Match in message text
        const matchingMessages = raw.chat_messages.filter(m =>
          m.text.toLowerCase().includes(lowerQuery)
        )
        score += matchingMessages.length

        if (score > 0) {
          const tags = tagsMap[raw.uuid] || []
          results.push({
            conversation: rawToConversation(raw, entry.fileName, tags, entry.account),
            score
          })
        }
      }
    } catch (err) {
      console.error(`Failed to parse ${entry.filePath}:`, err)
      continue
    }
  }

  // Sort by score descending, then by updatedAt descending
  results.sort((a, b) => {
    if (b.score !== a.score) {
      return b.score - a.score
    }
    return b.conversation.updatedAt.localeCompare(a.conversation.updatedAt)
  })

  return results.map(r => r.conversation)
}

/**
 * Set tags for a conversation
 */
export async function setConversationTags(
  vaultDir: string,
  uuid: string,
  tags: string[]
): Promise<void> {
  const chatExportsDir = path.join(vaultDir, 'ChatExports')

  // Validate path
  if (!validatePath(chatExportsDir, vaultDir)) {
    throw new Error('Invalid chat exports path')
  }

  // Validate UUID format
  if (!/^[a-z0-9-]+$/i.test(uuid) || uuid.includes('..') || uuid.includes('/') || uuid.includes('\\')) {
    throw new Error('Invalid conversation UUID')
  }

  // Load current tags
  const tagsMap = await loadTags(chatExportsDir)

  // Update tags for this conversation
  if (tags.length === 0) {
    delete tagsMap[uuid]
  } else {
    tagsMap[uuid] = tags
  }

  // Save updated tags
  await saveTags(chatExportsDir, tagsMap)
}
