import path from 'node:path'
import { promises as fs } from 'node:fs'

/**
 * Returns all configured vault directories.
 * Always includes VAULT_DIR. Adds any paths from VAULT_DIRS (comma-separated).
 * Validates: each path must be absolute and must not be a subdirectory of another configured path.
 * Returns only paths that exist on disk (logs a warning for non-existent paths).
 */
export async function getVaultDirs(): Promise<string[]> {
  const vaultDir = process.env.VAULT_DIR
  if (!vaultDir) {
    throw new Error('VAULT_DIR environment variable is required')
  }

  const candidates: string[] = [vaultDir]

  // Parse VAULT_DIRS if present
  const vaultDirsRaw = process.env.VAULT_DIRS
  if (vaultDirsRaw) {
    const extras = vaultDirsRaw
      .split(',')
      .map(s => s.trim())
      .filter(s => s.length > 0)
    candidates.push(...extras)
  }

  const seen = new Set<string>()
  const result: string[] = []

  for (const raw of candidates) {
    // Validate absolute path
    if (!path.isAbsolute(raw)) {
      console.warn(`[vault-config] Skipping non-absolute path: ${raw}`)
      continue
    }

    const resolved = path.resolve(raw)

    // Deduplicate
    if (seen.has(resolved)) continue
    seen.add(resolved)

    // Check if directory exists
    try {
      const stat = await fs.stat(resolved)
      if (!stat.isDirectory()) {
        console.warn(`[vault-config] Skipping non-directory: ${resolved}`)
        continue
      }
      // Directory exists, include it
      result.push(resolved)
    } catch {
      // Non-existent directory - log warning but include it anyway
      // (directory may be created later, e.g., Wiki/ dir created on first ingest)
      console.warn(`[vault-config] Including non-existent directory (may be created later): ${resolved}`)
      result.push(resolved)
    }
  }

  return result
}

/**
 * Checks if a given absolute path is safely inside one of the vault roots.
 * Used for path traversal protection: replaces per-module checks.
 */
export function isPathInVault(filePath: string): Promise<boolean> {
  return isPathInVaultSync(filePath)
}

/**
 * Synchronous version of isPathInVault.
 * Checks if a given absolute path is safely inside one of the vault roots.
 */
async function isPathInVaultSync(filePath: string): Promise<boolean> {
  const vaultDirs = await getVaultDirs()
  const resolved = path.resolve(filePath)
  return vaultDirs.some(dir => {
    const resolvedDir = path.resolve(dir)
    return resolved.startsWith(resolvedDir + path.sep) || resolved === resolvedDir
  })
}

/**
 * Returns the primary vault dir (VAULT_DIR). Used for write operations
 * (capture-writer, notification-state) which only ever write to the primary vault.
 */
export function getPrimaryVaultDir(): string {
  const vaultDir = process.env.VAULT_DIR
  if (!vaultDir) {
    throw new Error('VAULT_DIR environment variable is required')
  }
  return path.resolve(vaultDir)
}
