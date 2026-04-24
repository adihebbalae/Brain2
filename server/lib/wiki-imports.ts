import crypto from 'node:crypto'
import path from 'node:path'
import { promises as fs, type Dirent } from 'node:fs'
import { parse as parseCsv } from 'csv-parse/sync'
import * as ical from 'node-ical'
import {
  ensureImportDirectories,
  getDataDir,
  getDatasetMirrorDir,
  getImportCatalogPath,
} from './data-dir.js'
import {
  extractHtmlText,
  parseChromeBookmarksHtml,
  parseYouTubeSearchHistoryHtml,
  parseYouTubeWatchHistoryHtml,
} from './wiki-import-parsers.js'
import type {
  ImportCatalog,
  ImportDataset,
  ImportIngestMode,
  ImportKind,
  IngestDatasetResult,
  NormalizeDatasetResult,
} from './wiki-import-types.js'
import { appendLog, ensureWikiExists, listPages } from './wiki-manager.js'
import { getPrimaryVaultDir } from './vault-config.js'

export interface ImportExecutionHooks {
  onDatasetStart?: (dataset: ImportDataset, index: number, total: number) => Promise<void> | void
  onDatasetComplete?: (dataset: ImportDataset, result: NormalizeDatasetResult | IngestDatasetResult) => Promise<void> | void
  onDatasetError?: (dataset: ImportDataset, error: Error) => Promise<void> | void
}

const STOPWORDS = new Set([
  'the', 'and', 'for', 'that', 'with', 'this', 'from', 'have', 'will', 'your', 'about', 'into',
  'their', 'there', 'where', 'when', 'what', 'which', 'were', 'been', 'more', 'than', 'they',
  'them', 'http', 'https', 'www', 'youtube', 'google', 'watch', 'view', 'video',
])

const IMPORT_INDEX_SEPARATOR = 'â€”'

const NORMALIZED_IMPORT_INDEX_SEPARATOR = IMPORT_INDEX_SEPARATOR.includes('â') ? 'â€”' : IMPORT_INDEX_SEPARATOR
const CHROME_WEBKIT_EPOCH_OFFSET_MICROSECONDS = 11644473600000000

interface SourceFingerprint {
  path: string
  hash: string
  sizeBytes: number
}

interface ClaudeConversation {
  uuid: string
  name?: string
  summary?: string
  created_at?: string
  updated_at?: string
  account?: string
  chat_messages?: Array<{
    uuid?: string
    sender?: string
    text?: string
    content?: string
    created_at?: string
  }>
}

interface ChromeHistoryEntry {
  title?: string
  url?: string
  time_usec?: number | string
  page_transition_qualifier?: string
  favicon_url?: string
  client_id?: string
}

interface NormalizeContext {
  seenClaudeConversationIds: Set<string>
}

export async function readImportCatalog(): Promise<ImportCatalog> {
  await ensureImportDirectories()

  try {
    const content = await fs.readFile(getImportCatalogPath(), 'utf-8')
    const parsed = JSON.parse(content) as ImportCatalog
    return {
      lastScannedAt: parsed.lastScannedAt ?? null,
      datasets: Array.isArray(parsed.datasets) ? parsed.datasets : [],
    }
  } catch {
    return {
      lastScannedAt: null,
      datasets: [],
    }
  }
}

export async function writeImportCatalog(catalog: ImportCatalog): Promise<void> {
  await ensureImportDirectories()
  await fs.writeFile(getImportCatalogPath(), JSON.stringify(catalog, null, 2), 'utf-8')
}

export async function scanImportDatasets(): Promise<ImportCatalog> {
  await ensureImportDirectories()

  const dataDir = getDataDir()
  const scanTimestamp = new Date().toISOString()
  const datasets: ImportDataset[] = []

  let entries: Dirent[]
  try {
    entries = await fs.readdir(dataDir, { withFileTypes: true })
  } catch {
    const catalog = { lastScannedAt: scanTimestamp, datasets: [] }
    await writeImportCatalog(catalog)
    return catalog
  }

  for (const entry of entries) {
    if (!entry.isDirectory() || entry.name === 'imports') {
      continue
    }

    const entryPath = path.join(dataDir, entry.name)

    if (entry.name.startsWith('data-') && await exists(path.join(entryPath, 'conversations.json'))) {
      datasets.push(await discoverClaudeDataset(entry.name, entryPath, scanTimestamp))
      continue
    }

    const takeoutDir = path.join(entryPath, 'Takeout')
    if (!await exists(takeoutDir)) {
      continue
    }

    const chromeDir = path.join(takeoutDir, 'Chrome')
    if (await exists(chromeDir)) {
      datasets.push(await discoverTakeoutProductDataset(entry.name, 'chrome', chromeDir, scanTimestamp))
    }

    const youtubeDir = path.join(takeoutDir, 'YouTube and YouTube Music')
    if (await exists(youtubeDir)) {
      datasets.push(await discoverTakeoutProductDataset(entry.name, 'youtube', youtubeDir, scanTimestamp))
    }

    const calendarDir = path.join(takeoutDir, 'Calendar')
    if (await exists(calendarDir)) {
      datasets.push(await discoverTakeoutProductDataset(entry.name, 'calendar', calendarDir, scanTimestamp))
    }

    const discoverDir = path.join(takeoutDir, 'Discover')
    if (await exists(discoverDir)) {
      datasets.push(await discoverTakeoutProductDataset(entry.name, 'discover', discoverDir, scanTimestamp))
    }

    const geminiDir = path.join(takeoutDir, 'Gemini')
    if (await exists(geminiDir)) {
      const dataset = await discoverTakeoutProductDataset(entry.name, 'gemini', geminiDir, scanTimestamp)
      if (dataset.sizeBytes < 1024) {
        dataset.warnings.push('Low-content Gemini export detected')
      }
      dataset.catalogOnly = true
      datasets.push(dataset)
    }

    const notebookLmDir = path.join(takeoutDir, 'NotebookLM')
    if (await exists(notebookLmDir)) {
      const notebookEntries = await fs.readdir(notebookLmDir, { withFileTypes: true })
      for (const notebookEntry of notebookEntries) {
        if (!notebookEntry.isDirectory()) {
          continue
        }

        datasets.push(await discoverNotebookDataset(entry.name, path.join(notebookLmDir, notebookEntry.name), notebookEntry.name, scanTimestamp))
      }
    }
  }

  const previousCatalog = await readImportCatalog()
  const previousById = new Map(previousCatalog.datasets.map(dataset => [dataset.id, dataset]))
  const mergedDatasets = datasets.map(dataset => {
    const previous = previousById.get(dataset.id)
    if (!previous) {
      return dataset
    }

    return {
      ...dataset,
      lastNormalizedAt: previous.lastNormalizedAt,
      lastIngestedAt: previous.lastIngestedAt,
      mirrorPath: previous.mirrorPath,
      normalized: previous.normalized && Boolean(previous.mirrorPath),
      ingested: previous.ingested,
    }
  })

  const catalog: ImportCatalog = {
    lastScannedAt: scanTimestamp,
    datasets: mergedDatasets.sort((left, right) => left.id.localeCompare(right.id)),
  }

  await writeImportCatalog(catalog)
  return catalog
}

export async function normalizeImportDatasets(
  datasetIds?: string[],
  hooks: ImportExecutionHooks = {},
): Promise<{ catalog: ImportCatalog; results: NormalizeDatasetResult[] }> {
  let catalog = await readImportCatalog()
  if (catalog.datasets.length === 0) {
    catalog = await scanImportDatasets()
  }

  const datasets = selectDatasets(catalog.datasets, datasetIds)
  const context: NormalizeContext = {
    seenClaudeConversationIds: new Set<string>(),
  }

  const results: NormalizeDatasetResult[] = []

  for (const [index, dataset] of datasets.entries()) {
    await hooks.onDatasetStart?.(dataset, index, datasets.length)

    try {
      const result = await normalizeDataset(dataset, context)
      results.push(result)

      updateCatalogDataset(catalog, dataset.id, current => ({
        ...current,
        warnings: dedupeStrings(result.warnings),
        counts: result.counts,
        mirrorPath: getDatasetMirrorDir(dataset.id),
        lastNormalizedAt: new Date().toISOString(),
        normalized: true,
      }))

      await writeImportCatalog(catalog)
      await hooks.onDatasetComplete?.(dataset, result)
    } catch (error) {
      const normalizedError = toError(error)
      await hooks.onDatasetError?.(dataset, normalizedError)
    }
  }

  return { catalog, results }
}

export async function ingestImportDatasets(
  datasetIds: string[],
  mode: ImportIngestMode = 'default',
  hooks: ImportExecutionHooks = {},
): Promise<{ catalog: ImportCatalog; results: IngestDatasetResult[] }> {
  let catalog = await readImportCatalog()
  if (catalog.datasets.length === 0) {
    catalog = await scanImportDatasets()
  }

  const datasets = selectDatasets(catalog.datasets, datasetIds)
  const results: IngestDatasetResult[] = []

  for (const [index, dataset] of datasets.entries()) {
    await hooks.onDatasetStart?.(dataset, index, datasets.length)

    try {
      const result = await ingestDataset(dataset, mode)
      results.push(result)

      updateCatalogDataset(catalog, dataset.id, current => ({
        ...current,
        lastIngestedAt: new Date().toISOString(),
        ingested: result.createdPages.length + result.updatedPages.length > 0 || current.ingested,
      }))

      await writeImportCatalog(catalog)
      await hooks.onDatasetComplete?.(dataset, result)
    } catch (error) {
      const normalizedError = toError(error)
      await hooks.onDatasetError?.(dataset, normalizedError)
    }
  }

  return { catalog, results }
}

export async function listWikiImportsState(): Promise<{
  datasets: ImportDataset[]
  lastScannedAt: string | null
}> {
  const catalog = await readImportCatalog()
  return {
    datasets: catalog.datasets,
    lastScannedAt: catalog.lastScannedAt,
  }
}

export async function findLegacyYouTubeHistoryPath(): Promise<string | null> {
  const configured = process.env.YOUTUBE_HISTORY_PATH?.trim()
  if (configured) {
    return configured
  }

  const catalog = await readImportCatalog()
  const youtubeDataset = catalog.datasets.find(dataset => dataset.kind === 'youtube')
  if (!youtubeDataset) {
    return null
  }

  const historyDir = path.join(youtubeDataset.sourceRoot, 'history')
  const watchHtmlPath = path.join(historyDir, 'watch-history.html')
  if (await exists(watchHtmlPath)) {
    return watchHtmlPath
  }

  return findFirstMatchingFile(getDataDir(), filePath => {
    const normalized = filePath.replace(/\\/g, '/').toLowerCase()
    return normalized.endsWith('/watch-history.html') || normalized.endsWith('/watch-history.json')
  })
}

async function discoverClaudeDataset(folderName: string, datasetRoot: string, scanTimestamp: string): Promise<ImportDataset> {
  const counts: Record<string, number> = {
    conversations: await countJsonArray(path.join(datasetRoot, 'conversations.json')),
    memories: await countJsonArray(path.join(datasetRoot, 'memories.json')),
    projects: await countJsonArray(path.join(datasetRoot, 'projects.json')),
    users: await countJsonArray(path.join(datasetRoot, 'users.json')),
  }

  const stats = await collectDirectoryStats(datasetRoot)

  return {
    id: `claude:${folderName}`,
    kind: 'claude',
    title: `Claude Export ${folderName}`,
    sourceRoot: datasetRoot,
    sourcePaths: joinExistingPaths(datasetRoot, ['conversations.json', 'memories.json', 'projects.json', 'users.json']),
    sizeBytes: stats.sizeBytes,
    fileCount: stats.fileCount,
    warnings: counts.conversations === 0 ? ['No conversations found in export'] : [],
    catalogOnly: false,
    counts,
    lastScannedAt: scanTimestamp,
    normalized: false,
    ingested: false,
  }
}

async function discoverTakeoutProductDataset(
  folderName: string,
  kind: Exclude<ImportKind, 'claude' | 'notebooklm'>,
  datasetRoot: string,
  scanTimestamp: string,
): Promise<ImportDataset> {
  const stats = await collectDirectoryStats(datasetRoot)
  const counts: Record<string, number> = {}
  const warnings: string[] = []

  if (kind === 'chrome') {
    counts.historyEntries = await countChromeHistoryEntries(path.join(datasetRoot, 'History.json'))
    counts.bookmarkLinks = await countBookmarkLinks(path.join(datasetRoot, 'Bookmarks.html'))
    counts.readingListLinks = await countBookmarkLinks(path.join(datasetRoot, 'Reading List.html'))
    if (counts.historyEntries === 0) {
      warnings.push('Chrome history export is empty or unreadable')
    }
  }

  if (kind === 'youtube') {
    counts.watchHistoryFiles = await exists(path.join(datasetRoot, 'history', 'watch-history.html')) ? 1 : 0
    counts.searchHistoryFiles = await exists(path.join(datasetRoot, 'history', 'search-history.html')) ? 1 : 0
    counts.playlistFiles = await countMatchingFiles(path.join(datasetRoot, 'playlists'), '.csv')
    counts.subscriptionFiles = await countMatchingFiles(path.join(datasetRoot, 'subscriptions'), '.csv')
    if (counts.watchHistoryFiles === 0 && counts.searchHistoryFiles === 0) {
      warnings.push('No YouTube history HTML files found')
    }
  }

  if (kind === 'calendar') {
    counts.calendarFiles = await countMatchingFiles(datasetRoot, '.ics')
  }

  if (kind === 'discover') {
    counts.csvFiles = await countMatchingFiles(datasetRoot, '.csv')
  }

  if (kind === 'gemini') {
    counts.files = stats.fileCount
  }

  return {
    id: `takeout:${folderName}:${kind}`,
    kind,
    title: `${capitalize(kind)} Export ${folderName}`,
    sourceRoot: datasetRoot,
    sourcePaths: [datasetRoot],
    sizeBytes: stats.sizeBytes,
    fileCount: stats.fileCount,
    warnings,
    catalogOnly: kind === 'gemini',
    counts,
    lastScannedAt: scanTimestamp,
    normalized: false,
    ingested: false,
  }
}

async function discoverNotebookDataset(
  folderName: string,
  datasetRoot: string,
  notebookName: string,
  scanTimestamp: string,
): Promise<ImportDataset> {
  const stats = await collectDirectoryStats(datasetRoot)
  const counts = {
    sources: await countMatchingFiles(path.join(datasetRoot, 'Sources'), '.html'),
    chats: await countMatchingFiles(path.join(datasetRoot, 'Chat History'), '.html'),
    artifactMetadata: await countMatchingFiles(path.join(datasetRoot, 'Artifacts'), 'metadata.json'),
  }

  const warnings: string[] = []
  if (counts.sources === 0) {
    warnings.push('NotebookLM export has no HTML source files')
  }

  return {
    id: `takeout:${folderName}:notebooklm:${slugify(notebookName)}`,
    kind: 'notebooklm',
    title: `NotebookLM ${notebookName}`,
    sourceRoot: datasetRoot,
    sourcePaths: [datasetRoot],
    sizeBytes: stats.sizeBytes,
    fileCount: stats.fileCount,
    warnings,
    catalogOnly: false,
    counts,
    lastScannedAt: scanTimestamp,
    normalized: false,
    ingested: false,
  }
}

async function normalizeDataset(dataset: ImportDataset, context: NormalizeContext): Promise<NormalizeDatasetResult> {
  const mirrorDir = getDatasetMirrorDir(dataset.id)
  await fs.rm(mirrorDir, { recursive: true, force: true })
  await fs.mkdir(mirrorDir, { recursive: true })

  const fingerprints = await fingerprintDatasetSources(dataset)
  const warnings = [...dataset.warnings]

  let result: NormalizeDatasetResult
  switch (dataset.kind) {
    case 'claude':
      result = await normalizeClaudeDataset(dataset, mirrorDir, context)
      break
    case 'notebooklm':
      result = await normalizeNotebookDataset(dataset, mirrorDir)
      break
    case 'chrome':
      result = await normalizeChromeDataset(dataset, mirrorDir)
      break
    case 'youtube':
      result = await normalizeYouTubeDataset(dataset, mirrorDir)
      break
    case 'calendar':
      result = await normalizeCalendarDataset(dataset, mirrorDir)
      break
    case 'discover':
      result = await normalizeDiscoverDataset(dataset, mirrorDir)
      break
    case 'gemini':
      result = await normalizeGeminiDataset(dataset, mirrorDir)
      break
    default:
      throw new Error(`Unsupported dataset kind: ${dataset.kind satisfies never}`)
  }

  const manifest = {
    datasetId: dataset.id,
    kind: dataset.kind,
    title: dataset.title,
    normalizedAt: new Date().toISOString(),
    sourceFingerprints: fingerprints,
    counts: result.counts,
    warnings: dedupeStrings([...warnings, ...result.warnings]),
    mirrorFiles: result.mirrorFiles,
  }

  await writeJson(path.join(mirrorDir, 'manifest.json'), manifest)

  return {
    ...result,
    warnings: manifest.warnings,
  }
}

async function normalizeClaudeDataset(
  dataset: ImportDataset,
  mirrorDir: string,
  context: NormalizeContext,
): Promise<NormalizeDatasetResult> {
  const conversations = await readJsonFile<ClaudeConversation[]>(path.join(dataset.sourceRoot, 'conversations.json'), [])
  const mirrorFiles: string[] = []
  const conversationDir = path.join(mirrorDir, 'conversations')
  await fs.mkdir(conversationDir, { recursive: true })

  let mirroredConversationCount = 0
  let duplicateConversationCount = 0

  for (const conversation of conversations) {
    if (!conversation.uuid || context.seenClaudeConversationIds.has(conversation.uuid)) {
      duplicateConversationCount += 1
      continue
    }

    context.seenClaudeConversationIds.add(conversation.uuid)
    const fileName = `${conversation.uuid}.md`
    const filePath = path.join(conversationDir, fileName)
    const markdown = renderClaudeConversationMarkdown(conversation)
    await fs.writeFile(filePath, markdown, 'utf-8')
    mirrorFiles.push(relativePathFrom(mirrorDir, filePath))
    mirroredConversationCount += 1
  }

  const memories = await readJsonUnknown(path.join(dataset.sourceRoot, 'memories.json'))
  const projects = await readJsonUnknown(path.join(dataset.sourceRoot, 'projects.json'))
  const users = await readJsonUnknown(path.join(dataset.sourceRoot, 'users.json'))

  await writeMetadataMarkdown(path.join(mirrorDir, 'memories.md'), 'Claude Memories', memories)
  await writeMetadataMarkdown(path.join(mirrorDir, 'projects.md'), 'Claude Projects', projects)
  await writeMetadataMarkdown(path.join(mirrorDir, 'users.md'), 'Claude Users', users)
  mirrorFiles.push('memories.md', 'projects.md', 'users.md')

  return {
    datasetId: dataset.id,
    counts: {
      conversations: mirroredConversationCount,
      duplicateConversations: duplicateConversationCount,
      memories: Array.isArray(memories) ? memories.length : objectSize(memories),
      projects: Array.isArray(projects) ? projects.length : objectSize(projects),
      users: Array.isArray(users) ? users.length : objectSize(users),
    },
    warnings: [],
    mirrorFiles,
  }
}

async function normalizeNotebookDataset(dataset: ImportDataset, mirrorDir: string): Promise<NormalizeDatasetResult> {
  const mirrorFiles: string[] = []
  const notebookMetadataPath = await findNotebookMetadataPath(dataset.sourceRoot)
  const notebookMetadata = notebookMetadataPath ? await readJsonUnknown(notebookMetadataPath) : null

  const overviewMarkdown = [
    '# Notebook Overview',
    '',
    `- Dataset: ${dataset.id}`,
    `- Title: ${dataset.title}`,
    notebookMetadata ? '' : '- Metadata: unavailable',
    notebookMetadata ? '## Metadata' : '',
    notebookMetadata ? '```json' : '',
    notebookMetadata ? JSON.stringify(notebookMetadata, null, 2) : '',
    notebookMetadata ? '```' : '',
    '',
  ].filter(Boolean).join('\n')
  await fs.writeFile(path.join(mirrorDir, 'overview.md'), overviewMarkdown, 'utf-8')
  mirrorFiles.push('overview.md')

  const sourceFiles = await listFiles(path.join(dataset.sourceRoot, 'Sources'), entry => entry.endsWith('.html'))
  const chatFiles = await listFiles(path.join(dataset.sourceRoot, 'Chat History'), entry => entry.endsWith('.html'))
  const artifactMetadataFiles = await listFiles(path.join(dataset.sourceRoot, 'Artifacts'), entry => entry.endsWith('metadata.json'))

  await fs.mkdir(path.join(mirrorDir, 'sources'), { recursive: true })
  await fs.mkdir(path.join(mirrorDir, 'chats'), { recursive: true })
  await fs.mkdir(path.join(mirrorDir, 'artifacts'), { recursive: true })

  for (const filePath of sourceFiles) {
    const markdownPath = path.join(mirrorDir, 'sources', `${slugify(path.basename(filePath, '.html'))}.md`)
    const html = await fs.readFile(filePath, 'utf-8')
    const text = extractHtmlText(html)
    const metadata = await findSiblingMetadata(filePath)
    const markdown = renderNotebookSourceMarkdown(path.basename(filePath), metadata, text)
    await fs.writeFile(markdownPath, markdown, 'utf-8')
    mirrorFiles.push(relativePathFrom(mirrorDir, markdownPath))
  }

  for (const filePath of chatFiles) {
    const markdownPath = path.join(mirrorDir, 'chats', `${slugify(path.basename(filePath, '.html'))}.md`)
    const html = await fs.readFile(filePath, 'utf-8')
    const markdown = [
      `# ${path.basename(filePath, '.html')}`,
      '',
      extractHtmlText(html),
      '',
    ].join('\n')
    await fs.writeFile(markdownPath, markdown, 'utf-8')
    mirrorFiles.push(relativePathFrom(mirrorDir, markdownPath))
  }

  for (const filePath of artifactMetadataFiles) {
    const artifactMetadata = await readJsonUnknown(filePath)
    const markdownPath = path.join(mirrorDir, 'artifacts', `${slugify(path.basename(filePath, ' metadata.json'))}.md`)
    await writeMetadataMarkdown(markdownPath, path.basename(filePath, '.json'), artifactMetadata)
    mirrorFiles.push(relativePathFrom(mirrorDir, markdownPath))
  }

  return {
    datasetId: dataset.id,
    counts: {
      sources: sourceFiles.length,
      chats: chatFiles.length,
      artifacts: artifactMetadataFiles.length,
    },
    warnings: [],
    mirrorFiles,
  }
}

async function normalizeChromeDataset(dataset: ImportDataset, mirrorDir: string): Promise<NormalizeDatasetResult> {
  const historyPath = path.join(dataset.sourceRoot, 'History.json')
  const bookmarkPath = path.join(dataset.sourceRoot, 'Bookmarks.html')
  const readingListPath = path.join(dataset.sourceRoot, 'Reading List.html')
  const settingsPath = path.join(dataset.sourceRoot, 'Settings.json')
  const extensionsPath = path.join(dataset.sourceRoot, 'Extensions.json')

  const mirrorFiles: string[] = []
  const warnings: string[] = []

  const historyRoot = await readJsonUnknown(historyPath)
  const browserHistory = Array.isArray((historyRoot as Record<string, unknown>)?.['Browser History'])
    ? ((historyRoot as Record<string, unknown>)['Browser History'] as ChromeHistoryEntry[])
    : []
  const typedUrls = Array.isArray((historyRoot as Record<string, unknown>)?.['Typed Url'])
    ? ((historyRoot as Record<string, unknown>)['Typed Url'] as Array<Record<string, unknown>>)
    : []
  const sessions = Array.isArray((historyRoot as Record<string, unknown>)?.['Session'])
    ? ((historyRoot as Record<string, unknown>)['Session'] as Array<Record<string, unknown>>)
    : []

  const historyEvents = browserHistory
    .map(entry => normalizeChromeHistoryEntry(entry))
    .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry))

  if (historyEvents.length === 0) {
    warnings.push('No browser history entries could be normalized')
  }

  await writePartitionedJsonl(path.join(mirrorDir, 'events'), historyEvents, entry => entry.month)
  mirrorFiles.push(...await collectRelativeFiles(path.join(mirrorDir, 'events'), mirrorDir))

  const bookmarkHtml = await safeReadText(bookmarkPath)
  const readingListHtml = await safeReadText(readingListPath)
  const bookmarks = bookmarkHtml ? parseChromeBookmarksHtml(bookmarkHtml) : []
  const readingList = readingListHtml ? parseChromeBookmarksHtml(readingListHtml) : []

  if (bookmarks.length > 0) {
    await writeJson(path.join(mirrorDir, 'bookmarks.json'), bookmarks)
    mirrorFiles.push('bookmarks.json')
  }
  if (readingList.length > 0) {
    await writeJson(path.join(mirrorDir, 'reading-list.json'), readingList)
    mirrorFiles.push('reading-list.json')
  }

  const settings = await readJsonUnknown(settingsPath)
  const extensions = await readJsonUnknown(extensionsPath)
  if (settings) {
    await writeJson(path.join(mirrorDir, 'settings.json'), settings)
    mirrorFiles.push('settings.json')
  }
  if (extensions) {
    await writeJson(path.join(mirrorDir, 'extensions.json'), extensions)
    mirrorFiles.push('extensions.json')
  }

  const rollupMarkdown = renderChromeRollups(historyEvents, bookmarks, readingList, typedUrls.length, sessions.length)
  await fs.writeFile(path.join(mirrorDir, 'rollups.md'), rollupMarkdown, 'utf-8')
  mirrorFiles.push('rollups.md')

  return {
    datasetId: dataset.id,
    counts: {
      historyEvents: historyEvents.length,
      uniqueHistoryUrls: new Set(historyEvents.map(entry => entry.url)).size,
      bookmarks: bookmarks.length,
      readingList: readingList.length,
      typedUrls: typedUrls.length,
      sessions: sessions.length,
    },
    warnings,
    mirrorFiles,
  }
}

async function normalizeYouTubeDataset(dataset: ImportDataset, mirrorDir: string): Promise<NormalizeDatasetResult> {
  const historyDir = path.join(dataset.sourceRoot, 'history')
  const watchHtmlPath = path.join(historyDir, 'watch-history.html')
  const searchHtmlPath = path.join(historyDir, 'search-history.html')
  const playlistsDir = path.join(dataset.sourceRoot, 'playlists')
  const subscriptionsDir = path.join(dataset.sourceRoot, 'subscriptions')

  const watchHtml = await safeReadText(watchHtmlPath)
  const searchHtml = await safeReadText(searchHtmlPath)
  const watchEvents = watchHtml ? parseYouTubeWatchHistoryHtml(watchHtml) : []
  const searchEvents = searchHtml ? parseYouTubeSearchHistoryHtml(searchHtml) : []
  const playlistRows = await readCsvDirectory(playlistsDir)
  const subscriptionRows = await readCsvDirectory(subscriptionsDir)
  const mirrorFiles: string[] = []

  await writePartitionedJsonl(
    path.join(mirrorDir, 'watch'),
    watchEvents.map(entry => ({ ...entry, month: monthKey(entry.watchedAt) })),
    entry => entry.month,
  )
  await writePartitionedJsonl(
    path.join(mirrorDir, 'search'),
    searchEvents.map(entry => ({ ...entry, month: monthKey(entry.searchedAt) })),
    entry => entry.month,
  )
  mirrorFiles.push(...await collectRelativeFiles(path.join(mirrorDir, 'watch'), mirrorDir))
  mirrorFiles.push(...await collectRelativeFiles(path.join(mirrorDir, 'search'), mirrorDir))

  if (playlistRows.length > 0) {
    await writeJson(path.join(mirrorDir, 'playlists.json'), playlistRows)
    mirrorFiles.push('playlists.json')
  }
  if (subscriptionRows.length > 0) {
    await writeJson(path.join(mirrorDir, 'subscriptions.json'), subscriptionRows)
    mirrorFiles.push('subscriptions.json')
  }

  const rollupsMarkdown = renderYouTubeRollups(watchEvents, searchEvents, playlistRows, subscriptionRows)
  await fs.writeFile(path.join(mirrorDir, 'rollups.md'), rollupsMarkdown, 'utf-8')
  mirrorFiles.push('rollups.md')

  const warnings: string[] = []
  if (watchEvents.length === 0 && searchEvents.length === 0) {
    warnings.push('No YouTube HTML history entries could be normalized')
  }

  return {
    datasetId: dataset.id,
    counts: {
      watchEvents: watchEvents.length,
      searchEvents: searchEvents.length,
      uniqueWatchUrls: new Set(watchEvents.map(entry => entry.url)).size,
      playlists: playlistRows.length,
      subscriptions: subscriptionRows.length,
    },
    warnings,
    mirrorFiles,
  }
}

async function normalizeCalendarDataset(dataset: ImportDataset, mirrorDir: string): Promise<NormalizeDatasetResult> {
  const calendarFiles = await listFiles(dataset.sourceRoot, entry => entry.endsWith('.ics'))
  const events: Array<Record<string, string>> = []
  const seenUids = new Set<string>()

  for (const filePath of calendarFiles) {
    const parsed = await ical.async.parseFile(filePath)
    for (const item of Object.values(parsed)) {
      if (!item || item.type !== 'VEVENT') {
        continue
      }

      const uid = typeof item.uid === 'string' ? item.uid : `${filePath}:${item.start?.toISOString?.() ?? 'unknown'}`
      if (seenUids.has(uid)) {
        continue
      }
      seenUids.add(uid)

      const start = item.start instanceof Date ? item.start.toISOString() : ''
      const end = item.end instanceof Date ? item.end.toISOString() : ''
      if (!start) {
        continue
      }

      events.push({
        uid,
        calendar: path.basename(filePath),
        summary: typeof item.summary === 'string' ? item.summary : '(untitled event)',
        start,
        end,
        location: typeof item.location === 'string' ? item.location : '',
        month: monthKey(start),
      })
    }
  }

  await writePartitionedJsonl(path.join(mirrorDir, 'events'), events, entry => entry.month)
  const overviewMarkdown = renderCalendarOverview(events)
  await fs.writeFile(path.join(mirrorDir, 'rollups.md'), overviewMarkdown, 'utf-8')

  return {
    datasetId: dataset.id,
    counts: {
      events: events.length,
      calendars: calendarFiles.length,
    },
    warnings: events.length === 0 ? ['No calendar events could be normalized'] : [],
    mirrorFiles: [
      ...(await collectRelativeFiles(path.join(mirrorDir, 'events'), mirrorDir)),
      'rollups.md',
    ],
  }
}

async function normalizeDiscoverDataset(dataset: ImportDataset, mirrorDir: string): Promise<NormalizeDatasetResult> {
  const csvFiles = await listFiles(dataset.sourceRoot, entry => entry.endsWith('.csv'))
  const summaries: Array<{ file: string; rows: number; headers: string[] }> = []
  const mirrorFiles: string[] = []

  for (const filePath of csvFiles) {
    const csvContent = await fs.readFile(filePath, 'utf-8')
    const rows = parseCsv(csvContent, {
      columns: true,
      skip_empty_lines: true,
    }) as Array<Record<string, string>>
    const fileName = `${slugify(path.basename(filePath, '.csv'))}.json`
    await writeJson(path.join(mirrorDir, fileName), rows)
    mirrorFiles.push(fileName)
    summaries.push({
      file: path.basename(filePath),
      rows: rows.length,
      headers: rows[0] ? Object.keys(rows[0]) : [],
    })
  }

  const rollupMarkdown = [
    '# Discover Export Overview',
    '',
    ...summaries.flatMap(summary => [
      `## ${summary.file}`,
      `- Rows: ${summary.rows}`,
      `- Columns: ${summary.headers.join(', ') || '(none)'}`,
      '',
    ]),
  ].join('\n')
  await fs.writeFile(path.join(mirrorDir, 'rollups.md'), rollupMarkdown, 'utf-8')
  mirrorFiles.push('rollups.md')

  return {
    datasetId: dataset.id,
    counts: {
      csvFiles: csvFiles.length,
      tables: summaries.length,
    },
    warnings: [],
    mirrorFiles,
  }
}

async function normalizeGeminiDataset(dataset: ImportDataset, mirrorDir: string): Promise<NormalizeDatasetResult> {
  const files = await listFiles(dataset.sourceRoot, () => true)
  const mirrorFiles: string[] = []
  const copied: Array<{ file: string; sizeBytes: number }> = []

  for (const filePath of files) {
    const content = await safeReadText(filePath)
    if (content === null) {
      continue
    }

    const relative = slugify(path.basename(filePath))
    const outputPath = path.join(mirrorDir, `${relative}.txt`)
    await fs.writeFile(outputPath, content, 'utf-8')
    mirrorFiles.push(relativePathFrom(mirrorDir, outputPath))
    copied.push({
      file: path.basename(filePath),
      sizeBytes: Buffer.byteLength(content, 'utf-8'),
    })
  }

  const lowContent = copied.every(file => file.sizeBytes < 256)
  const summaryMarkdown = [
    '# Gemini Export Overview',
    '',
    ...copied.map(file => `- ${file.file}: ${file.sizeBytes} bytes`),
    '',
    lowContent ? 'This export appears to be placeholder content only.' : '',
  ].filter(Boolean).join('\n')
  await fs.writeFile(path.join(mirrorDir, 'overview.md'), summaryMarkdown, 'utf-8')
  mirrorFiles.push('overview.md')

  return {
    datasetId: dataset.id,
    counts: {
      files: copied.length,
    },
    warnings: lowContent ? ['Gemini export appears to contain placeholder content only'] : [],
    mirrorFiles,
  }
}

async function ingestDataset(dataset: ImportDataset, requestedMode: ImportIngestMode): Promise<IngestDatasetResult> {
  const mirrorDir = getDatasetMirrorDir(dataset.id)
  if (!await exists(mirrorDir)) {
    throw new Error(`Dataset ${dataset.id} has not been normalized yet`)
  }

  const effectiveMode = requestedMode === 'default' ? getDefaultModeForDataset(dataset.kind) : requestedMode
  const markdownFiles = await resolveMirrorMarkdownFiles(mirrorDir, effectiveMode)
  const wikiDir = path.join(getPrimaryVaultDir(), 'Wiki')
  await ensureWikiExists(wikiDir)

  const existingPages = await listPages(wikiDir)
  const existingPageNames = new Set(existingPages.map(page => page.name))
  const createdPages: string[] = []
  const updatedPages: string[] = []
  const skippedFiles: string[] = []

  for (const filePath of markdownFiles) {
    const content = await fs.readFile(filePath, 'utf-8')
    if (!content.trim()) {
      skippedFiles.push(relativePathFrom(mirrorDir, filePath))
      continue
    }

    const pageName = buildImportedPageName(dataset, filePath, effectiveMode)
    const pagePath = path.join(wikiDir, `${pageName}.md`)
    const title = buildImportedPageTitle(dataset, filePath)
    const pageContent = createImportedWikiPage(title, pageName, dataset, filePath, content)

    if (existingPageNames.has(pageName) || await exists(pagePath)) {
      await fs.writeFile(pagePath, pageContent, 'utf-8')
      updatedPages.push(pageName)
    } else {
      await fs.writeFile(pagePath, pageContent, 'utf-8')
      createdPages.push(pageName)
      existingPageNames.add(pageName)
    }
  }

  await rebuildWikiIndex(wikiDir)
  await appendLog(wikiDir, 'import', `${dataset.id} (${effectiveMode}) created ${createdPages.length}, updated ${updatedPages.length}`)

  return {
    datasetId: dataset.id,
    mode: effectiveMode,
    createdPages,
    updatedPages,
    skippedFiles,
  }
}

async function resolveMirrorMarkdownFiles(mirrorDir: string, mode: Exclude<ImportIngestMode, 'default'>): Promise<string[]> {
  const files = await listFiles(mirrorDir, entry => entry.endsWith('.md'))

  if (mode === 'rollups') {
    return files.filter(filePath => path.basename(filePath) === 'rollups.md' || path.basename(filePath) === 'overview.md')
  }

  return files.filter(filePath => path.basename(filePath) !== 'manifest.json')
}

function getDefaultModeForDataset(kind: ImportKind): Exclude<ImportIngestMode, 'default'> {
  if (kind === 'claude' || kind === 'notebooklm') {
    return 'full-mirror'
  }

  return 'rollups'
}

function buildImportedPageName(dataset: ImportDataset, filePath: string, mode: Exclude<ImportIngestMode, 'default'>): string {
  const relative = relativePathFrom(getDatasetMirrorDir(dataset.id), filePath)
  const normalized = `${dataset.id}-${mode}-${relative.replace(/[\\/]/g, '-')}`
  return `${slugify(normalized).slice(0, 96)}-${shortHash(normalized)}`
}

function buildImportedPageTitle(dataset: ImportDataset, filePath: string): string {
  const relative = relativePathFrom(getDatasetMirrorDir(dataset.id), filePath).replace(/\\/g, '/')
  return `${dataset.title} / ${relative.replace(/\.md$/i, '')}`
}

function createImportedWikiPage(
  title: string,
  pageName: string,
  dataset: ImportDataset,
  sourceFilePath: string,
  content: string,
): string {
  const today = new Date().toISOString().split('T')[0]
  const relativeMirrorPath = relativePathFrom(getDatasetMirrorDir(dataset.id), sourceFilePath).replace(/\\/g, '/')

  return [
    '---',
    `title: ${escapeYamlScalar(title)}`,
    'status: seedling',
    'sources:',
    `  - data/imports/mirror/${encodeURIComponent(dataset.id)}/${relativeMirrorPath}`,
    `last_updated: ${today}`,
    '---',
    '',
    `# ${title}`,
    '',
    `Imported from dataset \`${dataset.id}\` as wiki page \`${pageName}\`.`,
    '',
    content.trim(),
    '',
  ].join('\n')
}

async function rebuildWikiIndex(wikiDir: string): Promise<void> {
  const pages = await listPages(wikiDir)
  const entries: string[] = []

  for (const page of pages) {
    const content = await fs.readFile(page.path, 'utf-8')
    const summary = extractWikiSummary(content)
    const sourceCount = page.sources.length
    entries.push(`- [[${page.name}]] ${NORMALIZED_IMPORT_INDEX_SEPARATOR} ${summary} (sources: ${sourceCount})`)
  }

  entries.sort((left, right) => left.localeCompare(right))
  const indexContent = ['# Wiki Index', '', ...entries, ''].join('\n')
  await fs.writeFile(path.join(wikiDir, 'index.md'), indexContent, 'utf-8')
}

function extractWikiSummary(content: string): string {
  const body = content
    .replace(/^---[\s\S]+?---\s*/m, '')
    .split('\n')
    .map(line => line.trim())
    .filter(line => line.length > 0 && !line.startsWith('#'))

  return body[0]?.slice(0, 140) || 'Imported wiki page.'
}

async function fingerprintDatasetSources(dataset: ImportDataset): Promise<SourceFingerprint[]> {
  const targets = dataset.sourcePaths.length > 0 ? dataset.sourcePaths : [dataset.sourceRoot]
  const files = await gatherFiles(targets)
  const fingerprints: SourceFingerprint[] = []

  for (const filePath of files) {
    const stat = await fs.stat(filePath)
    if (!stat.isFile()) {
      continue
    }

    const buffer = await fs.readFile(filePath)
    fingerprints.push({
      path: filePath,
      hash: crypto.createHash('sha256').update(buffer).digest('hex'),
      sizeBytes: buffer.byteLength,
    })
  }

  return fingerprints
}

async function gatherFiles(targets: string[]): Promise<string[]> {
  const files: string[] = []

  for (const target of targets) {
    if (!await exists(target)) {
      continue
    }

    const stat = await fs.stat(target)
    if (stat.isFile()) {
      files.push(target)
      continue
    }

    files.push(...await listFiles(target, () => true))
  }

  return files.sort()
}

async function listFiles(root: string, filter: (entryName: string) => boolean): Promise<string[]> {
  if (!await exists(root)) {
    return []
  }

  const results: string[] = []
  const stack = [root]

  while (stack.length > 0) {
    const current = stack.pop()!
    const entries = await fs.readdir(current, { withFileTypes: true })

    for (const entry of entries) {
      const entryPath = path.join(current, entry.name)
      if (entry.isDirectory()) {
        stack.push(entryPath)
      } else if (entry.isFile() && filter(entry.name)) {
        results.push(entryPath)
      }
    }
  }

  return results.sort()
}

async function findFirstMatchingFile(
  root: string,
  predicate: (filePath: string) => boolean,
): Promise<string | null> {
  const files = await listFiles(root, () => true)
  return files.find(predicate) ?? null
}

async function countMatchingFiles(root: string, suffix: string): Promise<number> {
  return (await listFiles(root, entry => entry.endsWith(suffix))).length
}

async function countJsonArray(filePath: string): Promise<number> {
  const data = await readJsonUnknown(filePath)
  return Array.isArray(data) ? data.length : 0
}

async function countChromeHistoryEntries(filePath: string): Promise<number> {
  const root = await readJsonUnknown(filePath)
  const browserHistory = (root as Record<string, unknown>)?.['Browser History']
  return Array.isArray(browserHistory) ? browserHistory.length : 0
}

async function countBookmarkLinks(filePath: string): Promise<number> {
  const html = await safeReadText(filePath)
  return html ? parseChromeBookmarksHtml(html).length : 0
}

async function collectDirectoryStats(root: string): Promise<{ sizeBytes: number; fileCount: number }> {
  let sizeBytes = 0
  let fileCount = 0

  const files = await listFiles(root, () => true)
  for (const filePath of files) {
    const stat = await fs.stat(filePath)
    sizeBytes += stat.size
    fileCount += 1
  }

  return { sizeBytes, fileCount }
}

async function findNotebookMetadataPath(datasetRoot: string): Promise<string | null> {
  const baseName = path.basename(datasetRoot)
  const candidates = [
    path.join(datasetRoot, `${baseName} metadata.json`),
    path.join(datasetRoot, `${baseName}.json`),
  ]

  for (const candidate of candidates) {
    if (await exists(candidate)) {
      return candidate
    }
  }

  const files = await listFiles(datasetRoot, entry => entry.endsWith('.json') && !entry.endsWith('metadata.json'))
  return files[0] ?? null
}

async function findSiblingMetadata(htmlFilePath: string): Promise<unknown | null> {
  const metadataCandidates = [
    `${htmlFilePath} metadata.json`,
    htmlFilePath.replace(/\.html$/i, '.json'),
    htmlFilePath.replace(/\.html$/i, ' metadata.json'),
    `${path.join(path.dirname(htmlFilePath), path.basename(htmlFilePath, '.html'))} metadata.json`,
  ]

  for (const candidate of metadataCandidates) {
    if (await exists(candidate)) {
      return readJsonUnknown(candidate)
    }
  }

  return null
}

function renderClaudeConversationMarkdown(conversation: ClaudeConversation): string {
  const title = conversation.name || conversation.uuid
  const summary = conversation.summary?.trim()
  const messages = conversation.chat_messages ?? []

  return [
    `# ${title}`,
    '',
    `- UUID: ${conversation.uuid}`,
    `- Account: ${conversation.account || 'default'}`,
    `- Created: ${conversation.created_at || '(unknown)'}`,
    `- Updated: ${conversation.updated_at || '(unknown)'}`,
    summary ? '' : '',
    summary ? '## Summary' : '',
    summary || '',
    summary ? '' : '',
    '## Conversation',
    '',
    ...messages.flatMap(message => {
      const sender = message.sender || 'unknown'
      const text = normalizeConversationText(message.text || message.content || '')
      return [
        `### ${capitalize(sender)}${message.created_at ? ` (${message.created_at})` : ''}`,
        '',
        text || '(empty message)',
        '',
      ]
    }),
  ].filter(Boolean).join('\n')
}

function renderNotebookSourceMarkdown(fileName: string, metadata: unknown | null, text: string): string {
  return [
    `# ${fileName}`,
    '',
    metadata ? '## Metadata' : '',
    metadata ? '```json' : '',
    metadata ? JSON.stringify(metadata, null, 2) : '',
    metadata ? '```' : '',
    metadata ? '' : '',
    '## Extracted Text',
    '',
    text || '(no extracted text)',
    '',
  ].filter(Boolean).join('\n')
}

async function writeMetadataMarkdown(outputPath: string, title: string, value: unknown): Promise<void> {
  const markdown = [
    `# ${title}`,
    '',
    '```json',
    JSON.stringify(value, null, 2),
    '```',
    '',
  ].join('\n')
  await fs.writeFile(outputPath, markdown, 'utf-8')
}

function renderChromeRollups(
  historyEvents: Array<{ title: string; url: string; visitedAt: string; month: string; domain: string }>,
  bookmarks: Array<{ title: string; url: string }>,
  readingList: Array<{ title: string; url: string }>,
  typedUrlCount: number,
  sessionCount: number,
): string {
  const monthGroups = groupBy(historyEvents, event => event.month)
  const lines = [
    '# Chrome Rollups',
    '',
    `- Total history events: ${historyEvents.length}`,
    `- Unique history URLs: ${new Set(historyEvents.map(event => event.url)).size}`,
    `- Bookmarks: ${bookmarks.length}`,
    `- Reading list items: ${readingList.length}`,
    `- Typed URLs: ${typedUrlCount}`,
    `- Sessions: ${sessionCount}`,
    '',
  ]

  for (const [month, entries] of Array.from(monthGroups.entries()).sort((left, right) => right[0].localeCompare(left[0]))) {
    const domainCounts = countStrings(entries.map(entry => entry.domain))
    const topicCounts = countStrings(entries.flatMap(entry => extractKeywords(`${entry.title} ${entry.url}`)))
    lines.push(`## ${month}`)
    lines.push(`- eventCount: ${entries.length}`)
    lines.push(`- uniqueUrlCount: ${new Set(entries.map(entry => entry.url)).size}`)
    lines.push(`- topDomains: ${formatCountList(domainCounts, 8)}`)
    lines.push(`- topTopics: ${formatCountList(topicCounts, 8)}`)
    lines.push('')
  }

  return lines.join('\n')
}

function renderYouTubeRollups(
  watchEvents: Array<{ title: string; url: string; channel: string; watchedAt: string }>,
  searchEvents: Array<{ query: string; searchedAt: string }>,
  playlists: Array<Record<string, string>>,
  subscriptions: Array<Record<string, string>>,
): string {
  const watchByMonth = groupBy(watchEvents, entry => monthKey(entry.watchedAt))
  const searchByMonth = groupBy(searchEvents, entry => monthKey(entry.searchedAt))
  const lines = [
    '# YouTube Rollups',
    '',
    `- Watch events: ${watchEvents.length}`,
    `- Unique watched URLs: ${new Set(watchEvents.map(entry => entry.url)).size}`,
    `- Search events: ${searchEvents.length}`,
    `- Playlist rows: ${playlists.length}`,
    `- Subscription rows: ${subscriptions.length}`,
    '',
  ]

  const months = Array.from(new Set([...watchByMonth.keys(), ...searchByMonth.keys()])).sort((left, right) => right.localeCompare(left))
  for (const month of months) {
    const watchEntries = watchByMonth.get(month) ?? []
    const searchEntries = searchByMonth.get(month) ?? []
    lines.push(`## ${month}`)
    lines.push(`- watchEventCount: ${watchEntries.length}`)
    lines.push(`- uniqueUrlCount: ${new Set(watchEntries.map(entry => entry.url)).size}`)
    lines.push(`- topChannels: ${formatCountList(countStrings(watchEntries.map(entry => entry.channel)), 8)}`)
    lines.push(`- topSearchTerms: ${formatCountList(countStrings(searchEntries.map(entry => entry.query.toLowerCase())), 8)}`)
    lines.push('')
  }

  return lines.join('\n')
}

function renderCalendarOverview(events: Array<Record<string, string>>): string {
  const monthGroups = groupBy(events, entry => entry.month)
  const lines = [
    '# Calendar Rollups',
    '',
    `- Total events: ${events.length}`,
    `- Unique UIDs: ${new Set(events.map(event => event.uid)).size}`,
    '',
  ]

  for (const [month, entries] of Array.from(monthGroups.entries()).sort((left, right) => right[0].localeCompare(left[0]))) {
    lines.push(`## ${month}`)
    lines.push(`- eventCount: ${entries.length}`)
    lines.push(`- uniqueUrlCount: 0`)
    lines.push(`- topCalendars: ${formatCountList(countStrings(entries.map(entry => entry.calendar)), 8)}`)
    lines.push('')
  }

  return lines.join('\n')
}

async function writePartitionedJsonl<T extends Record<string, unknown>>(
  rootDir: string,
  entries: T[],
  partitionKey: (entry: T) => string,
): Promise<void> {
  await fs.mkdir(rootDir, { recursive: true })
  const groups = groupBy(entries, entry => partitionKey(entry))

  for (const [partition, partitionEntries] of groups.entries()) {
    const outputPath = path.join(rootDir, `${partition}.jsonl`)
    const content = partitionEntries.map(entry => JSON.stringify(entry)).join('\n')
    await fs.writeFile(outputPath, content ? `${content}\n` : '', 'utf-8')
  }
}

async function readCsvDirectory(root: string): Promise<Array<Record<string, string>>> {
  const files = await listFiles(root, entry => entry.endsWith('.csv'))
  const rows: Array<Record<string, string>> = []

  for (const filePath of files) {
    const content = await fs.readFile(filePath, 'utf-8')
    const parsed = parseCsv(content, {
      columns: true,
      skip_empty_lines: true,
    }) as Array<Record<string, string>>

    for (const row of parsed) {
      rows.push({
        __file: path.basename(filePath),
        ...row,
      })
    }
  }

  return rows
}

async function collectRelativeFiles(root: string, mirrorDir: string): Promise<string[]> {
  const files = await listFiles(root, () => true)
  return files.map(filePath => relativePathFrom(mirrorDir, filePath))
}

async function safeReadText(filePath: string): Promise<string | null> {
  try {
    return await fs.readFile(filePath, 'utf-8')
  } catch {
    return null
  }
}

async function readJsonUnknown(filePath: string): Promise<unknown | null> {
  try {
    const content = await fs.readFile(filePath, 'utf-8')
    return JSON.parse(content) as unknown
  } catch {
    return null
  }
}

async function readJsonFile<T>(filePath: string, fallback: T): Promise<T> {
  const value = await readJsonUnknown(filePath)
  return (value as T) ?? fallback
}

async function writeJson(filePath: string, value: unknown): Promise<void> {
  await fs.mkdir(path.dirname(filePath), { recursive: true })
  await fs.writeFile(filePath, JSON.stringify(value, null, 2), 'utf-8')
}

async function exists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath)
    return true
  } catch {
    return false
  }
}

function joinExistingPaths(root: string, names: string[]): string[] {
  return names.map(name => path.join(root, name))
}

function normalizeChromeHistoryEntry(entry: ChromeHistoryEntry): { title: string; url: string; visitedAt: string; month: string; domain: string } | null {
  if (!entry.url || !entry.time_usec) {
    return null
  }

  const rawValue = typeof entry.time_usec === 'string' ? Number(entry.time_usec) : entry.time_usec
  if (!Number.isFinite(rawValue)) {
    return null
  }

  const visitedAt = chromeTimestampToDate(rawValue)
  if (Number.isNaN(visitedAt.getTime())) {
    return null
  }

  return {
    title: entry.title?.trim() || entry.url,
    url: entry.url,
    visitedAt: visitedAt.toISOString(),
    month: monthKey(visitedAt.toISOString()),
    domain: hostnameForUrl(entry.url),
  }
}

function countStrings(values: string[]): Map<string, number> {
  const counts = new Map<string, number>()
  for (const value of values) {
    const normalized = value.trim()
    if (!normalized) {
      continue
    }

    counts.set(normalized, (counts.get(normalized) || 0) + 1)
  }

  return counts
}

function formatCountList(counts: Map<string, number>, limit: number): string {
  const entries = Array.from(counts.entries())
    .sort((left, right) => {
      if (right[1] !== left[1]) {
        return right[1] - left[1]
      }

      return left[0].localeCompare(right[0])
    })
    .slice(0, limit)

  if (entries.length === 0) {
    return '(none)'
  }

  return entries.map(([value, count]) => `${value} (${count})`).join(', ')
}

function groupBy<T>(values: T[], key: (value: T) => string): Map<string, T[]> {
  const groups = new Map<string, T[]>()
  for (const value of values) {
    const groupKey = key(value)
    const groupValues = groups.get(groupKey) ?? []
    groupValues.push(value)
    groups.set(groupKey, groupValues)
  }

  return groups
}

function extractKeywords(value: string): string[] {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(word => word.length >= 4 && !STOPWORDS.has(word))
}

function monthKey(value: string): string {
  const date = new Date(value)
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`
}

function hostnameForUrl(value: string): string {
  try {
    return new URL(value).hostname.replace(/^www\./, '')
  } catch {
    return '(invalid-url)'
  }
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 120) || 'item'
}

function shortHash(value: string): string {
  return crypto.createHash('sha1').update(value).digest('hex').slice(0, 10)
}

function relativePathFrom(root: string, filePath: string): string {
  return path.relative(root, filePath)
}

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1)
}

function dedupeStrings(values: string[]): string[] {
  return Array.from(new Set(values.filter(Boolean)))
}

function chromeTimestampToDate(rawValue: number): Date {
  if (rawValue > CHROME_WEBKIT_EPOCH_OFFSET_MICROSECONDS) {
    return new Date((rawValue - CHROME_WEBKIT_EPOCH_OFFSET_MICROSECONDS) / 1000)
  }

  if (rawValue > 1e12) {
    return new Date(rawValue / 1000)
  }

  if (rawValue > 1e10) {
    return new Date(rawValue)
  }

  return new Date(rawValue * 1000)
}

function toError(error: unknown): Error {
  return error instanceof Error ? error : new Error(String(error))
}

function normalizeConversationText(value: string): string {
  return value.replace(/\r/g, '').trim()
}

function objectSize(value: unknown): number {
  if (Array.isArray(value)) {
    return value.length
  }

  if (value && typeof value === 'object') {
    return Object.keys(value).length
  }

  return value == null ? 0 : 1
}

function selectDatasets(datasets: ImportDataset[], datasetIds?: string[]): ImportDataset[] {
  if (!datasetIds || datasetIds.length === 0) {
    return datasets
  }

  const wanted = new Set(datasetIds)
  return datasets.filter(dataset => wanted.has(dataset.id))
}

function updateCatalogDataset(
  catalog: ImportCatalog,
  datasetId: string,
  updater: (dataset: ImportDataset) => ImportDataset,
): void {
  catalog.datasets = catalog.datasets.map(dataset => dataset.id === datasetId ? updater(dataset) : dataset)
}

function escapeYamlScalar(value: string): string {
  if (/[:#\n]/.test(value)) {
    return JSON.stringify(value)
  }

  return value
}
