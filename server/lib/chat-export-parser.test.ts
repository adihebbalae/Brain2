import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { promises as fs } from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import {
  listConversations,
  searchConversations,
  getConversation,
  setConversationTags
} from './chat-export-parser.js'

describe('chat-export-parser', () => {
  let testDir: string
  let vaultDir: string
  let chatExportsDir: string

  beforeEach(async () => {
    // Create temporary test directories
    testDir = path.join(
      os.tmpdir(),
      `test-chats-${Date.now()}-${Math.random().toString(36).substring(7)}`
    )
    vaultDir = path.join(testDir, 'vault')
    chatExportsDir = path.join(vaultDir, 'ChatExports')

    await fs.mkdir(chatExportsDir, { recursive: true })
  })

  afterEach(async () => {
    // Clean up test directory
    await fs.rm(testDir, { recursive: true, force: true })
  })

  describe('listConversations', () => {
    it('returns empty array when directory is empty', async () => {
      const conversations = await listConversations(vaultDir)
      expect(conversations).toEqual([])
    })

    it('parses a single export file with one conversation', async () => {
      const exportData = [
        {
          uuid: 'conv-1',
          name: 'Test Conversation',
          created_at: '2026-03-15T10:00:00Z',
          updated_at: '2026-03-15T11:00:00Z',
          chat_messages: [
            {
              uuid: 'msg-1',
              sender: 'human' as const,
              text: 'Hello, how are you?',
              created_at: '2026-03-15T10:00:00Z'
            },
            {
              uuid: 'msg-2',
              sender: 'assistant' as const,
              text: 'I am doing well, thank you!',
              created_at: '2026-03-15T10:01:00Z'
            }
          ]
        }
      ]

      await fs.writeFile(
        path.join(chatExportsDir, 'export-1.json'),
        JSON.stringify(exportData)
      )

      const conversations = await listConversations(vaultDir)

      expect(conversations).toHaveLength(1)
      expect(conversations[0]).toMatchObject({
        uuid: 'conv-1',
        name: 'Test Conversation',
        createdAt: '2026-03-15T10:00:00Z',
        updatedAt: '2026-03-15T11:00:00Z',
        messageCount: 2,
        preview: 'Hello, how are you?',
        tags: [],
        sourceFile: 'export-1.json'
      })
    })

    it('parses multiple conversations from multiple files', async () => {
      const export1 = [
        {
          uuid: 'conv-1',
          name: 'First Conversation',
          created_at: '2026-03-01T10:00:00Z',
          updated_at: '2026-03-01T11:00:00Z',
          chat_messages: [
            {
              uuid: 'msg-1',
              sender: 'human' as const,
              text: 'First message',
              created_at: '2026-03-01T10:00:00Z'
            }
          ]
        }
      ]

      const export2 = [
        {
          uuid: 'conv-2',
          name: 'Second Conversation',
          created_at: '2026-03-02T10:00:00Z',
          updated_at: '2026-03-02T11:00:00Z',
          chat_messages: [
            {
              uuid: 'msg-2',
              sender: 'human' as const,
              text: 'Second message',
              created_at: '2026-03-02T10:00:00Z'
            }
          ]
        }
      ]

      await fs.writeFile(
        path.join(chatExportsDir, 'export-1.json'),
        JSON.stringify(export1)
      )
      await fs.writeFile(
        path.join(chatExportsDir, 'export-2.json'),
        JSON.stringify(export2)
      )

      const conversations = await listConversations(vaultDir)

      expect(conversations).toHaveLength(2)
      expect(conversations[0].name).toBe('Second Conversation') // Sorted by updatedAt desc
      expect(conversations[1].name).toBe('First Conversation')
    })

    it('truncates preview to 200 characters', async () => {
      const longMessage = 'A'.repeat(250)
      const exportData = [
        {
          uuid: 'conv-1',
          name: 'Test',
          created_at: '2026-03-15T10:00:00Z',
          updated_at: '2026-03-15T11:00:00Z',
          chat_messages: [
            {
              uuid: 'msg-1',
              sender: 'human' as const,
              text: longMessage,
              created_at: '2026-03-15T10:00:00Z'
            }
          ]
        }
      ]

      await fs.writeFile(
        path.join(chatExportsDir, 'export-1.json'),
        JSON.stringify(exportData)
      )

      const conversations = await listConversations(vaultDir)

      expect(conversations[0].preview).toHaveLength(200)
      expect(conversations[0].preview).toBe('A'.repeat(200))
    })

    it('uses "(No messages)" when there are no human messages', async () => {
      const exportData = [
        {
          uuid: 'conv-1',
          name: 'Test',
          created_at: '2026-03-15T10:00:00Z',
          updated_at: '2026-03-15T11:00:00Z',
          chat_messages: [
            {
              uuid: 'msg-1',
              sender: 'assistant' as const,
              text: 'Assistant message only',
              created_at: '2026-03-15T10:00:00Z'
            }
          ]
        }
      ]

      await fs.writeFile(
        path.join(chatExportsDir, 'export-1.json'),
        JSON.stringify(exportData)
      )

      const conversations = await listConversations(vaultDir)

      expect(conversations[0].preview).toBe('(No messages)')
    })

    it('merges tags from .tags.json', async () => {
      const exportData = [
        {
          uuid: 'conv-1',
          name: 'Test',
          created_at: '2026-03-15T10:00:00Z',
          updated_at: '2026-03-15T11:00:00Z',
          chat_messages: []
        }
      ]

      const tagsData = {
        'conv-1': ['project-a', 'important']
      }

      await fs.writeFile(
        path.join(chatExportsDir, 'export-1.json'),
        JSON.stringify(exportData)
      )
      await fs.writeFile(
        path.join(chatExportsDir, '.tags.json'),
        JSON.stringify(tagsData)
      )

      const conversations = await listConversations(vaultDir)

      expect(conversations[0].tags).toEqual(['project-a', 'important'])
    })

    it('ignores .tags.json when scanning for export files', async () => {
      const tagsData = { 'conv-1': ['tag1'] }

      await fs.writeFile(
        path.join(chatExportsDir, '.tags.json'),
        JSON.stringify(tagsData)
      )

      const conversations = await listConversations(vaultDir)

      expect(conversations).toEqual([])
    })

    it('skips malformed JSON files gracefully', async () => {
      const validExport = [
        {
          uuid: 'conv-1',
          name: 'Valid',
          created_at: '2026-03-15T10:00:00Z',
          updated_at: '2026-03-15T11:00:00Z',
          chat_messages: []
        }
      ]

      await fs.writeFile(
        path.join(chatExportsDir, 'valid.json'),
        JSON.stringify(validExport)
      )
      await fs.writeFile(path.join(chatExportsDir, 'invalid.json'), 'not valid json')

      const conversations = await listConversations(vaultDir)

      expect(conversations).toHaveLength(1)
      expect(conversations[0].name).toBe('Valid')
    })
  })

  describe('getConversation', () => {
    it('returns conversation with full messages', async () => {
      const exportData = [
        {
          uuid: 'conv-1',
          name: 'Test Conversation',
          created_at: '2026-03-15T10:00:00Z',
          updated_at: '2026-03-15T11:00:00Z',
          chat_messages: [
            {
              uuid: 'msg-1',
              sender: 'human' as const,
              text: 'Hello',
              created_at: '2026-03-15T10:00:00Z'
            },
            {
              uuid: 'msg-2',
              sender: 'assistant' as const,
              text: 'Hi there!',
              created_at: '2026-03-15T10:01:00Z'
            }
          ]
        }
      ]

      await fs.writeFile(
        path.join(chatExportsDir, 'export-1.json'),
        JSON.stringify(exportData)
      )

      const conversation = await getConversation(vaultDir, 'conv-1')

      expect(conversation).not.toBeNull()
      expect(conversation?.uuid).toBe('conv-1')
      expect(conversation?.messages).toHaveLength(2)
      expect(conversation?.messages[0]).toMatchObject({
        uuid: 'msg-1',
        sender: 'human',
        text: 'Hello',
        createdAt: '2026-03-15T10:00:00Z'
      })
    })

    it('returns null when conversation not found', async () => {
      const conversation = await getConversation(vaultDir, 'non-existent')

      expect(conversation).toBeNull()
    })

    it('includes tags from .tags.json', async () => {
      const exportData = [
        {
          uuid: 'conv-1',
          name: 'Test',
          created_at: '2026-03-15T10:00:00Z',
          updated_at: '2026-03-15T11:00:00Z',
          chat_messages: []
        }
      ]

      const tagsData = {
        'conv-1': ['tag1', 'tag2']
      }

      await fs.writeFile(
        path.join(chatExportsDir, 'export-1.json'),
        JSON.stringify(exportData)
      )
      await fs.writeFile(
        path.join(chatExportsDir, '.tags.json'),
        JSON.stringify(tagsData)
      )

      const conversation = await getConversation(vaultDir, 'conv-1')

      expect(conversation?.tags).toEqual(['tag1', 'tag2'])
    })

    it('rejects path traversal in UUID', async () => {
      await expect(getConversation(vaultDir, '../../../etc/passwd')).rejects.toThrow(
        'Invalid conversation UUID'
      )
    })
  })

  describe('searchConversations', () => {
    beforeEach(async () => {
      const exportData = [
        {
          uuid: 'conv-1',
          name: 'Ollama Setup Guide',
          created_at: '2026-03-01T10:00:00Z',
          updated_at: '2026-03-01T11:00:00Z',
          chat_messages: [
            {
              uuid: 'msg-1',
              sender: 'human' as const,
              text: 'How do I install Ollama on Linux?',
              created_at: '2026-03-01T10:00:00Z'
            },
            {
              uuid: 'msg-2',
              sender: 'assistant' as const,
              text: 'You can install Ollama with: curl https://ollama.ai/install.sh | sh',
              created_at: '2026-03-01T10:01:00Z'
            }
          ]
        },
        {
          uuid: 'conv-2',
          name: 'React Best Practices',
          created_at: '2026-03-02T10:00:00Z',
          updated_at: '2026-03-02T11:00:00Z',
          chat_messages: [
            {
              uuid: 'msg-3',
              sender: 'human' as const,
              text: 'What are some React hooks best practices?',
              created_at: '2026-03-02T10:00:00Z'
            }
          ]
        },
        {
          uuid: 'conv-3',
          name: 'Docker Configuration',
          created_at: '2026-03-03T10:00:00Z',
          updated_at: '2026-03-03T11:00:00Z',
          chat_messages: [
            {
              uuid: 'msg-4',
              sender: 'human' as const,
              text: 'Help me configure Ollama in Docker',
              created_at: '2026-03-03T10:00:00Z'
            }
          ]
        }
      ]

      await fs.writeFile(
        path.join(chatExportsDir, 'export-1.json'),
        JSON.stringify(exportData)
      )
    })

    it('finds conversations matching in name (case-insensitive)', async () => {
      const results = await searchConversations(vaultDir, 'ollama')

      expect(results).toHaveLength(2)
      // Title match should rank higher than content match
      expect(results[0].name).toBe('Ollama Setup Guide')
    })

    it('finds conversations matching in message text', async () => {
      const results = await searchConversations(vaultDir, 'React hooks')

      expect(results).toHaveLength(1)
      expect(results[0].name).toBe('React Best Practices')
    })

    it('ranks title matches higher than content matches', async () => {
      const results = await searchConversations(vaultDir, 'ollama')

      // conv-1 has "Ollama" in title (score 10 + 2 messages = 12)
      // conv-3 has "Ollama" in message only (score 1)
      expect(results[0].name).toBe('Ollama Setup Guide')
      expect(results[1].name).toBe('Docker Configuration')
    })

    it('returns empty array when no matches', async () => {
      const results = await searchConversations(vaultDir, 'nonexistent search term')

      expect(results).toEqual([])
    })

    it('returns all conversations when query is empty', async () => {
      const results = await searchConversations(vaultDir, '')

      expect(results).toHaveLength(3)
    })

    it('is case-insensitive', async () => {
      const results = await searchConversations(vaultDir, 'OLLAMA')

      expect(results).toHaveLength(2)
    })
  })

  describe('setConversationTags', () => {
    it('creates .tags.json and saves tags', async () => {
      await setConversationTags(vaultDir, 'conv-1', ['tag1', 'tag2'])

      const tagsPath = path.join(chatExportsDir, '.tags.json')
      const content = await fs.readFile(tagsPath, 'utf-8')
      const tags = JSON.parse(content)

      expect(tags).toEqual({
        'conv-1': ['tag1', 'tag2']
      })
    })

    it('updates existing tags', async () => {
      const initialTags = {
        'conv-1': ['old-tag']
      }

      await fs.writeFile(
        path.join(chatExportsDir, '.tags.json'),
        JSON.stringify(initialTags)
      )

      await setConversationTags(vaultDir, 'conv-1', ['new-tag'])

      const tagsPath = path.join(chatExportsDir, '.tags.json')
      const content = await fs.readFile(tagsPath, 'utf-8')
      const tags = JSON.parse(content)

      expect(tags['conv-1']).toEqual(['new-tag'])
    })

    it('removes conversation from tags when tags array is empty', async () => {
      const initialTags = {
        'conv-1': ['tag1'],
        'conv-2': ['tag2']
      }

      await fs.writeFile(
        path.join(chatExportsDir, '.tags.json'),
        JSON.stringify(initialTags)
      )

      await setConversationTags(vaultDir, 'conv-1', [])

      const tagsPath = path.join(chatExportsDir, '.tags.json')
      const content = await fs.readFile(tagsPath, 'utf-8')
      const tags = JSON.parse(content)

      expect(tags).toEqual({
        'conv-2': ['tag2']
      })
      expect(tags['conv-1']).toBeUndefined()
    })

    it('persists tags and they appear in listConversations', async () => {
      const exportData = [
        {
          uuid: 'conv-1',
          name: 'Test',
          created_at: '2026-03-15T10:00:00Z',
          updated_at: '2026-03-15T11:00:00Z',
          chat_messages: []
        }
      ]

      await fs.writeFile(
        path.join(chatExportsDir, 'export-1.json'),
        JSON.stringify(exportData)
      )

      await setConversationTags(vaultDir, 'conv-1', ['project-a', 'important'])

      const conversations = await listConversations(vaultDir)

      expect(conversations[0].tags).toEqual(['project-a', 'important'])
    })

    it('rejects path traversal in UUID', async () => {
      await expect(
        setConversationTags(vaultDir, '../../../etc/passwd', ['tag1'])
      ).rejects.toThrow('Invalid conversation UUID')
    })
  })
})
