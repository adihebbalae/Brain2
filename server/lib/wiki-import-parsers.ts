import { load } from 'cheerio'

export interface ParsedBookmark {
  title: string
  url: string
  addDate?: string
  lastModified?: string
}

export interface ParsedYouTubeWatchEntry {
  action: 'Watched' | 'Viewed'
  title: string
  url: string
  channel: string
  watchedAt: string
  isAd: boolean
}

export interface ParsedYouTubeSearchEntry {
  query: string
  url: string
  searchedAt: string
}

export function extractHtmlText(html: string): string {
  const $ = load(html)
  $('script, style, noscript').remove()
  $('br').replaceWith('\n')
  return $.root().text().replace(/\u00a0/g, ' ').replace(/\r/g, '').replace(/\n{3,}/g, '\n\n').trim()
}

export function parseChromeBookmarksHtml(html: string): ParsedBookmark[] {
  const $ = load(html)
  const bookmarks: ParsedBookmark[] = []

  $('a[href]').each((_index, element) => {
    const node = $(element)
    const href = node.attr('href')?.trim()
    if (!href) {
      return
    }

    bookmarks.push({
      title: normalizeWhitespace(node.text()) || href,
      url: href,
      addDate: node.attr('add_date') || undefined,
      lastModified: node.attr('last_modified') || undefined,
    })
  })

  return bookmarks
}

export function parseYouTubeWatchHistoryHtml(html: string): ParsedYouTubeWatchEntry[] {
  const $ = load(html)
  const entries: ParsedYouTubeWatchEntry[] = []

  $('.outer-cell').each((_index, element) => {
    const contentCell = $(element).find('.content-cell.mdl-cell--6-col').first()
    if (contentCell.length === 0) {
      return
    }

    const htmlContent = contentCell.html() ?? ''
    const lines = htmlToLines(htmlContent)
    if (lines.length < 2) {
      return
    }

    const firstLine = lines[0]
    const action = firstLine.startsWith('Viewed') ? 'Viewed' : firstLine.startsWith('Watched') ? 'Watched' : null
    if (!action) {
      return
    }

    const links = contentCell.find('a')
    const url = links.first().attr('href')?.trim()
    if (!url) {
      return
    }

    const title = normalizeWhitespace(links.first().text()) || url
    const channel = links.length > 1 ? normalizeWhitespace($(links[1]).text()) || 'Unknown Channel' : 'Unknown Channel'
    const watchedAt = parseActivityTimestamp(lines)
    if (!watchedAt) {
      return
    }

    const caption = normalizeWhitespace($(element).find('.mdl-typography--caption').text())
    entries.push({
      action,
      title,
      url,
      channel,
      watchedAt,
      isAd: caption.includes('From Google Ads'),
    })
  })

  return entries
}

export function parseYouTubeSearchHistoryHtml(html: string): ParsedYouTubeSearchEntry[] {
  const $ = load(html)
  const entries: ParsedYouTubeSearchEntry[] = []

  $('.outer-cell').each((_index, element) => {
    const contentCell = $(element).find('.content-cell.mdl-cell--6-col').first()
    if (contentCell.length === 0) {
      return
    }

    const htmlContent = contentCell.html() ?? ''
    const lines = htmlToLines(htmlContent)
    if (lines.length < 2 || !lines[0].startsWith('Searched for')) {
      return
    }

    const link = contentCell.find('a').first()
    const url = link.attr('href')?.trim()
    if (!url) {
      return
    }

    const searchedAt = parseActivityTimestamp(lines)
    if (!searchedAt) {
      return
    }

    entries.push({
      query: normalizeWhitespace(link.text()),
      url,
      searchedAt,
    })
  })

  return entries
}

function htmlToLines(html: string): string[] {
  return extractHtmlText(html)
    .split('\n')
    .map(line => normalizeWhitespace(line))
    .filter(Boolean)
}

function parseActivityTimestamp(lines: string[]): string | null {
  for (let index = lines.length - 1; index >= 0; index -= 1) {
    const normalized = lines[index].replace(/[^\S\r\n]+/g, ' ').replace(/\u202f/g, ' ').trim()
    const parsed = Date.parse(normalized)
    if (!Number.isNaN(parsed)) {
      return new Date(parsed).toISOString()
    }
  }

  return null
}

function normalizeWhitespace(value: string): string {
  return value
    .replace(/\u00a0/g, ' ')
    .replace(/\u202f/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}
