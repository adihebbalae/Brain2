/**
 * Multi-vault directory resolution.
 * Reads VAULT_DIR (required) and VAULT_DIRS (optional, comma-separated) from env.
 * Returns a deduplicated list of resolved vault directories that exist on disk.
 * Non-existent paths are skipped with a warning log.
 */

import path from 'node:path'
import { promises as fs } from 'node:fs'

/**
 * Resolve all configured vault directories.
 * Always includes VAULT_DIR. VAULT_DIRS items are appended (deduplicated).
 * Non-existent directories are logged and skipped.
 */
export async function resolveVaultDirs(
  vaultDir: string,
  vaultDirsRaw?: string
): Promise<string[]> {
  const seen = new Set<string>()
  const result: string[] = []

  const candidates: string[] = [vaultDir]

  if (vaultDirsRaw) {
    const extras = vaultDirsRaw
      .split(',')
      .map(s => s.trim())
      .filter(s => s.length > 0)
    candidates.push(...extras)
  }

  for (const raw of candidates) {
    const resolved = path.resolve(raw)

    // Deduplicate
    if (seen.has(resolved)) continue
    seen.add(resolved)

    // Check existence
    try {
      const stat = await fs.stat(resolved)
      if (!stat.isDirectory()) {
        console.warn(`[vault-dirs] Skipping non-directory: ${resolved}`)
        continue
      }
      result.push(resolved)
    } catch {
      console.warn(`[vault-dirs] Skipping non-existent directory: ${resolved}`)
    }
  }

  return result
}

/**
 * Validate that a file path is inside one of the allowed vault directories.
 * Used for path traversal protection across multi-vault operations.
 */
export function isPathInVaults(filePath: string, vaultDirs: string[]): boolean {
  const resolved = path.resolve(filePath)
  return vaultDirs.some(dir => {
    return resolved.startsWith(dir + path.sep) || resolved === dir
  })
}
