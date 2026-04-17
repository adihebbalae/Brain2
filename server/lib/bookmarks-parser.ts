import { promises as fs } from 'node:fs'
import path from 'node:path'

export interface BookmarkItem {
  name: string
  url: string
  addedAt: Date
  source: 'bookmarks'
}

interface ChromeBookmarkNode {
  type?: string
  name?: string
  url?: string
  date_added?: string
  children?: ChromeBookmarkNode[]
}

interface ChromeBookmarksFile {
  roots?: {
    bookmark_bar?: ChromeBookmarkNode
    other?: ChromeBookmarkNode
    synced?: ChromeBookmarkNode
  }
}

/**
 * Convert Windows FILETIME (microseconds since Jan 1, 1601) to JS Date
 */
function convertFileTime(fileTime: string): Date {
  const microseconds = parseInt(fileTime, 10)
  // FILETIME is microseconds since Jan 1, 1601
  // JavaScript Date is milliseconds since Jan 1, 1970
  // Difference between 1601 and 1970 is 11644473600 seconds
  const milliseconds = microseconds / 1000 - 11644473600000
  return new Date(milliseconds)
}

/**
 * Recursively walk the Chrome bookmarks tree and extract all URL nodes
 */
function walkBookmarkTree(node: ChromeBookmarkNode, results: BookmarkItem[]): void {
  if (!node) return

  // If it's a URL node, extract it
  if (node.type === 'url' && node.url && node.name) {
    results.push({
      name: node.name,
      url: node.url,
      addedAt: node.date_added ? convertFileTime(node.date_added) : new Date(0),
      source: 'bookmarks',
    })
  }

  // If it has children, recurse
  if (node.children && Array.isArray(node.children)) {
    for (const child of node.children) {
      walkBookmarkTree(child, results)
    }
  }
}

/**
 * Get the platform-specific path to Chrome bookmarks file
 */
export function getChromeBookmarksPath(): string {
  const envPath = process.env.CHROME_BOOKMARKS_PATH
  if (envPath) {
    return envPath
  }

  const localAppData = process.env.LOCALAPPDATA || ''
  return path.join(localAppData, 'Google', 'Chrome', 'User Data', 'Default', 'Bookmarks')
}

/**
 * Parse Chrome bookmarks file and extract all bookmarks
 */
export async function parseChromebookmarks(): Promise<BookmarkItem[]> {
  const bookmarksPath = getChromeBookmarksPath()

  try {
    const content = await fs.readFile(bookmarksPath, 'utf-8')
    const data: ChromeBookmarksFile = JSON.parse(content)

    const results: BookmarkItem[] = []

    // Walk all three root trees
    if (data.roots) {
      if (data.roots.bookmark_bar) {
        walkBookmarkTree(data.roots.bookmark_bar, results)
      }
      if (data.roots.other) {
        walkBookmarkTree(data.roots.other, results)
      }
      if (data.roots.synced) {
        walkBookmarkTree(data.roots.synced, results)
      }
    }

    return results
  } catch (err) {
    // Gracefully handle missing file - return empty array
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
      console.warn(`Chrome bookmarks file not found at ${bookmarksPath}`)
      return []
    }
    throw err
  }
}
