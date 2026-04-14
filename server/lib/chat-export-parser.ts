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
  tags: string[]
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
    sourceFile
  }
}

/**
 * Convert raw conversation to ConversationDetail (with messages)
 */
function rawToConversationDetail(
  raw: RawConversation,
  sourceFile: string,
  tags: string[]
): ConversationDetail {
  const base = rawToConversation(raw, sourceFile, tags)
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
 * List all conversations from ChatExports directory
 */
export async function listConversations(vaultDir: string): Promise<Conversation[]> {
  const chatExportsDir = path.join(vaultDir, 'ChatExports')

  // Validate path
  if (!validatePath(chatExportsDir, vaultDir)) {
    throw new Error('Invalid chat exports path')
  }

  // Load tags
  const tagsMap = await loadTags(chatExportsDir)

  // Scan directory for JSON files
  let files: string[] = []
  try {
    const entries = await fs.readdir(chatExportsDir)
    files = entries.filter(f => f.endsWith('.json') && f !== '.tags.json')
  } catch (err) {
    // Directory doesn't exist or can't be read
    return []
  }

  // Parse all conversations from all files
  const conversations: Conversation[] = []
  for (const file of files) {
    const filePath = path.join(chatExportsDir, file)

    if (!validatePath(filePath, chatExportsDir)) {
      continue // Skip files outside the directory
    }

    try {
      const content = await fs.readFile(filePath, 'utf-8')
      const rawConversations = JSON.parse(content) as RawConversation[]

      for (const raw of rawConversations) {
        const tags = tagsMap[raw.uuid] || []
        conversations.push(rawToConversation(raw, file, tags))
      }
    } catch (err) {
      console.error(`Failed to parse ${file}:`, err)
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

  // Scan all files to find the conversation
  let files: string[] = []
  try {
    const entries = await fs.readdir(chatExportsDir)
    files = entries.filter(f => f.endsWith('.json') && f !== '.tags.json')
  } catch {
    return null
  }

  for (const file of files) {
    const filePath = path.join(chatExportsDir, file)

    if (!validatePath(filePath, chatExportsDir)) {
      continue
    }

    try {
      const content = await fs.readFile(filePath, 'utf-8')
      const rawConversations = JSON.parse(content) as RawConversation[]

      const found = rawConversations.find(c => c.uuid === uuid)
      if (found) {
        const tags = tagsMap[uuid] || []
        return rawToConversationDetail(found, file, tags)
      }
    } catch (err) {
      console.error(`Failed to parse ${file}:`, err)
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
  query: string
): Promise<Conversation[]> {
  const chatExportsDir = path.join(vaultDir, 'ChatExports')

  // Validate path
  if (!validatePath(chatExportsDir, vaultDir)) {
    throw new Error('Invalid chat exports path')
  }

  if (!query.trim()) {
    return listConversations(vaultDir)
  }

  const lowerQuery = query.toLowerCase()

  // Load tags
  const tagsMap = await loadTags(chatExportsDir)

  // Scan all files
  let files: string[] = []
  try {
    const entries = await fs.readdir(chatExportsDir)
    files = entries.filter(f => f.endsWith('.json') && f !== '.tags.json')
  } catch {
    return []
  }

  // Parse and search
  const results: Array<{ conversation: Conversation; score: number }> = []

  for (const file of files) {
    const filePath = path.join(chatExportsDir, file)

    if (!validatePath(filePath, chatExportsDir)) {
      continue
    }

    try {
      const content = await fs.readFile(filePath, 'utf-8')
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
            conversation: rawToConversation(raw, file, tags),
            score
          })
        }
      }
    } catch (err) {
      console.error(`Failed to parse ${file}:`, err)
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
