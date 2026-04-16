/**
 * Wiki query and lint operations.
 *
 * POST /api/wiki/query   — Ollama reads index + relevant pages, synthesises answer with citations
 * POST /api/wiki/lint    — check orphans, stale pages, gaps, missing cross-references
 */

import { promises as fs } from 'node:fs'
import path from 'node:path'
import { parseIndex, extractWikiLinks } from './wiki-core.js'

/* ─── Types ─── */

export interface QueryResult {
  answer: string
  citations: string[]  // wiki page names referenced in the answer
}

export interface LintReport {
  orphans: string[]       // pages with no inbound links
  stale: string[]         // pages whose source is newer than wiki page mtime
  gaps: string[]          // concepts mentioned but lacking a page
  health_score: number    // 0-100
}

/* ─── Query ─── */

/**
 * Query the wiki: read index.md, find relevant pages by keyword match,
 * send to Ollama for answer synthesis with citations.
 */
export async function queryWiki(
  vaultDir: string,
  question: string
): Promise<QueryResult> {
  const wikiDir = path.join(vaultDir, 'Wiki')
  const index = await parseIndex(vaultDir)

  if (index.length === 0) {
    return { answer: 'Wiki is empty. Ingest some source documents first.', citations: [] }
  }

  // Find relevant pages by keyword match
  const lowerQ = question.toLowerCase()
  const relevantPages = index.filter(p =>
    p.name.toLowerCase().includes(lowerQ) ||
    p.summary.toLowerCase().includes(lowerQ)
  ).slice(0, 5)

  // If no keyword matches, use all pages (up to 10)
  const pagesToUse = relevantPages.length > 0 ? relevantPages : index.slice(0, 10)

  // Read page contents
  const pageContents: string[] = []
  for (const page of pagesToUse) {
    const filePath = path.join(wikiDir, page.file)
    try {
      const content = await fs.readFile(filePath, 'utf-8')
      pageContents.push(`--- ${page.name} ---\n${content.slice(0, 1000)}`)
    } catch {
      // Skip missing pages
    }
  }

  const indexMd = index.map(p => `- [[${p.name}]]: ${p.summary}`).join('\n')

  const prompt = `You are a knowledge assistant. Answer the question using ONLY the wiki pages provided below. Cite page names using [[Page Name]] format.

Wiki Index:
${indexMd}

Relevant Pages:
${pageContents.join('\n\n')}

Question: ${question}

Answer (use [[Page Name]] citations):`

  const ollamaUrl = process.env.OLLAMA_URL || 'http://localhost:11434'
  const ollamaModel = process.env.OLLAMA_MODEL || 'llama3.1:8b'

  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 30000)

    const response = await fetch(`${ollamaUrl}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: ollamaModel, prompt, stream: false }),
      signal: controller.signal,
    })

    clearTimeout(timeout)

    if (!response.ok) {
      throw new Error(`Ollama API error: ${response.status}`)
    }

    const data = await response.json()
    const answer = data.response?.trim() || 'Unable to generate answer.'
    const citations = extractWikiLinks(answer)

    return { answer, citations }
  } catch {
    return { answer: 'Ollama is not available. Cannot query wiki.', citations: [] }
  }
}

/* ─── Lint ─── */

/**
 * Lint the wiki for quality issues.
 */
export async function lintWiki(vaultDir: string): Promise<LintReport> {
  const wikiDir = path.join(vaultDir, 'Wiki')
  const index = await parseIndex(vaultDir)

  if (index.length === 0) {
    return { orphans: [], stale: [], gaps: [], health_score: 100 }
  }

  const pageNames = new Set(index.map(p => p.name))
  const allInboundLinks = new Map<string, number>()
  const allOutboundMentions: string[] = []

  // Initialize inbound count
  for (const p of index) {
    allInboundLinks.set(p.name, 0)
  }

  // Scan each page for outbound links
  for (const page of index) {
    const filePath = path.join(wikiDir, page.file)
    try {
      const content = await fs.readFile(filePath, 'utf-8')
      const links = extractWikiLinks(content)

      for (const link of links) {
        allOutboundMentions.push(link)
        if (allInboundLinks.has(link)) {
          allInboundLinks.set(link, (allInboundLinks.get(link) || 0) + 1)
        }
      }
    } catch {
      // Skip missing pages
    }
  }

  // Orphans: pages with zero inbound links (excluding the first/oldest page)
  const orphans = index
    .filter(p => (allInboundLinks.get(p.name) || 0) === 0)
    .map(p => p.name)

  // Gaps: concepts mentioned in wikilinks but lacking a page
  const gaps = [...new Set(allOutboundMentions)].filter(name => !pageNames.has(name))

  // Stale: check if any wiki pages are older than their source would suggest
  // (simplified: mark pages not updated in last 30 days as potentially stale)
  const stale: string[] = []
  for (const page of index) {
    const filePath = path.join(wikiDir, page.file)
    try {
      const stat = await fs.stat(filePath)
      const daysSinceModified = (Date.now() - stat.mtimeMs) / (1000 * 60 * 60 * 24)
      if (daysSinceModified > 30) {
        stale.push(page.name)
      }
    } catch {
      // Missing file = potentially stale
      stale.push(page.name)
    }
  }

  // Health score calculation
  const totalPages = index.length
  const orphanPenalty = (orphans.length / Math.max(totalPages, 1)) * 30
  const stalePenalty = (stale.length / Math.max(totalPages, 1)) * 30
  const gapPenalty = Math.min(gaps.length * 5, 40)
  const health_score = Math.max(0, Math.round(100 - orphanPenalty - stalePenalty - gapPenalty))

  return { orphans, stale, gaps, health_score }
}
