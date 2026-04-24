import path from 'node:path'
import { promises as fs } from 'node:fs'

export function getDataDir(): string {
  const configured = process.env.DATA_DIR?.trim()
  if (configured) {
    return path.resolve(configured)
  }

  return path.resolve(process.cwd(), 'data')
}

export function getImportsDir(): string {
  return path.join(getDataDir(), 'imports')
}

export function getImportJobsDir(): string {
  return path.join(getImportsDir(), 'jobs')
}

export function getImportMirrorDir(): string {
  return path.join(getImportsDir(), 'mirror')
}

export function getImportCatalogPath(): string {
  return path.join(getImportsDir(), 'catalog.json')
}

export async function ensureImportDirectories(): Promise<void> {
  await fs.mkdir(getImportsDir(), { recursive: true })
  await fs.mkdir(getImportJobsDir(), { recursive: true })
  await fs.mkdir(getImportMirrorDir(), { recursive: true })
}

export function getDatasetMirrorDir(datasetId: string): string {
  return path.join(getImportMirrorDir(), encodeURIComponent(datasetId))
}
