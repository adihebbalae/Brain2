import { appendFile, mkdir } from 'node:fs/promises'
import { join, resolve } from 'node:path'

export async function appendCapture(text: string, vaultDir: string): Promise<string> {
  // Validate vaultDir path
  const resolvedVault = resolve(vaultDir)
  const inboxPath = join(resolvedVault, 'Inbox', 'inbox.md')

  // Ensure Inbox directory exists
  await mkdir(join(resolvedVault, 'Inbox'), { recursive: true })

  // Trim whitespace from text
  const trimmedText = text.trim()

  // Format timestamp: YYYY-MM-DD HH:mm
  const now = new Date()
  const timestamp = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`

  const entry = `- [ ] [${timestamp}] ${trimmedText}`
  await appendFile(inboxPath, entry + '\n', 'utf-8')

  return entry
}
