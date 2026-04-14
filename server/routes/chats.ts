import { Router } from 'express'
import {
  listConversations,
  searchConversations,
  getConversation,
  setConversationTags
} from '../lib/chat-export-parser.js'
import { config } from 'dotenv'

config()

const router = Router()

// GET /api/chats - list all conversations
router.get('/', async (_req, res) => {
  const { VAULT_DIR } = process.env
  if (!VAULT_DIR) {
    return res.status(500).json({ error: 'VAULT_DIR not configured' })
  }

  try {
    const conversations = await listConversations(VAULT_DIR)
    return res.json(conversations)
  } catch (err) {
    console.error('Failed to list conversations:', err)
    return res.status(500).json({ error: 'Failed to list conversations' })
  }
})

// GET /api/chats/search?q=... - search conversations
router.get('/search', async (req, res) => {
  const { VAULT_DIR } = process.env
  if (!VAULT_DIR) {
    return res.status(500).json({ error: 'VAULT_DIR not configured' })
  }

  const query = req.query.q as string
  if (!query) {
    return res.status(400).json({ error: 'Query parameter "q" is required' })
  }

  try {
    const results = await searchConversations(VAULT_DIR, query)
    return res.json(results)
  } catch (err) {
    console.error('Failed to search conversations:', err)
    return res.status(500).json({ error: 'Failed to search conversations' })
  }
})

// GET /api/chats/:uuid - get single conversation with full messages
router.get('/:uuid', async (req, res) => {
  const { VAULT_DIR } = process.env
  if (!VAULT_DIR) {
    return res.status(500).json({ error: 'VAULT_DIR not configured' })
  }

  const { uuid } = req.params
  if (!uuid) {
    return res.status(400).json({ error: 'UUID is required' })
  }

  try {
    const conversation = await getConversation(VAULT_DIR, uuid)
    if (!conversation) {
      return res.status(404).json({ error: 'Conversation not found' })
    }
    return res.json(conversation)
  } catch (err) {
    const error = err as Error
    if (error.message === 'Invalid conversation UUID') {
      return res.status(400).json({ error: 'Invalid conversation UUID' })
    }
    console.error('Failed to get conversation:', err)
    return res.status(500).json({ error: 'Failed to get conversation' })
  }
})

// PATCH /api/chats/:uuid/tags - update tags
router.patch('/:uuid/tags', async (req, res) => {
  const { VAULT_DIR } = process.env
  if (!VAULT_DIR) {
    return res.status(500).json({ error: 'VAULT_DIR not configured' })
  }

  const { uuid } = req.params
  const { tags } = req.body

  if (!uuid) {
    return res.status(400).json({ error: 'UUID is required' })
  }

  if (!Array.isArray(tags)) {
    return res.status(400).json({ error: 'Tags must be an array' })
  }

  // Validate tags are all strings
  if (!tags.every(tag => typeof tag === 'string')) {
    return res.status(400).json({ error: 'All tags must be strings' })
  }

  try {
    await setConversationTags(VAULT_DIR, uuid, tags)
    return res.json({ success: true })
  } catch (err) {
    const error = err as Error
    if (error.message === 'Invalid conversation UUID') {
      return res.status(400).json({ error: 'Invalid conversation UUID' })
    }
    console.error('Failed to set conversation tags:', err)
    return res.status(500).json({ error: 'Failed to set conversation tags' })
  }
})

export { router as chatsRouter }
