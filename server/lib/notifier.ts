export interface NotifyOptions {
  title?: string
  priority?: 'default' | 'high' | 'urgent'
  tags?: string[]
}

/**
 * Sends a push notification via ntfy.sh (or a self-hosted ntfy instance).
 * Fire-and-forget: logs errors but never throws.
 */
export async function sendNotification(
  topic: string,
  message: string,
  options?: NotifyOptions
): Promise<void> {
  const ntfyBase = process.env.NTFY_URL || 'https://ntfy.sh'
  const url = `${ntfyBase}/${topic}`

  const headers: Record<string, string> = {
    'Content-Type': 'text/plain',
  }

  if (options?.title) {
    headers['Title'] = options.title
  }
  if (options?.priority) {
    headers['Priority'] = options.priority
  }
  if (options?.tags && options.tags.length > 0) {
    headers['Tags'] = options.tags.join(',')
  }

  try {
    await fetch(url, {
      method: 'POST',
      headers,
      body: message,
    })
  } catch (error) {
    console.error('[notifier] Failed to send notification:', error)
  }
}
