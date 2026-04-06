import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { createHash } from 'node:crypto'

export interface CorpusItem {
  id: string
  text: string
  type: 'todo' | 'idea' | 'note'
  source: 'corpus'
}

export async function parseNotesCorpus(corpusPath: string): Promise<CorpusItem[]> {
  try {
    // Validate and resolve path
    const resolvedPath = resolve(corpusPath)

    // Read file
    const content = await readFile(resolvedPath, 'utf-8')
    const lines = content.split('\n')

    const items: CorpusItem[] = []

    for (const line of lines) {
      const trimmed = line.trim()

      // Skip blank lines
      if (trimmed.length === 0) continue

      // Skip lines with only punctuation or very short lines
      if (trimmed.length < 10) continue
      if (/^[^a-zA-Z0-9]+$/.test(trimmed)) continue

      // Skip header lines (all-caps short strings, typically <50 chars and all uppercase)
      if (trimmed.length < 50 && trimmed === trimmed.toUpperCase() && /^[A-Z\s\-_:]+$/.test(trimmed)) {
        continue
      }

      let type: 'todo' | 'idea' | 'note' = 'note'

      // Check for TODO patterns
      if (
        /^[-*•]\s*\[\s*\]/.test(trimmed) || // - [ ] or * [ ] or • [ ]
        /^\[\s*\]/.test(trimmed) || // [ ] at start
        /^(TODO|todo|FIXME|HACK):?/i.test(trimmed) // TODO:, FIXME:, HACK:
      ) {
        type = 'todo'
      }
      // Check for IDEA patterns
      else if (
        /idea:/i.test(trimmed) || // idea:
        /idea\s*-/i.test(trimmed) || // idea -
        /^IDEA:/i.test(trimmed) // IDEA: at start
      ) {
        type = 'idea'
      }

      // Generate stable ID from content
      const id = generateStableId(trimmed)

      items.push({
        id,
        text: trimmed,
        type,
        source: 'corpus'
      })
    }

    return items
  } catch (err) {
    // File not found or not readable - return empty array silently
    return []
  }
}

function generateStableId(text: string): string {
  return createHash('sha256').update(text).digest('hex').substring(0, 16)
}
