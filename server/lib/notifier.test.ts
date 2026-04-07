import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { sendNotification } from './notifier.js'
import { wasNotifiedToday, wasNotifiedWithinDays, todayString } from './notification-state.js'

// ---------------------------------------------------------------------------
// sendNotification tests
// ---------------------------------------------------------------------------

describe('sendNotification', () => {
  let mockFetch: ReturnType<typeof vi.fn>

  beforeEach(() => {
    mockFetch = vi.fn().mockResolvedValue({ ok: true })
    vi.stubGlobal('fetch', mockFetch)
    // Ensure no NTFY_URL is set so we test the default
    delete process.env.NTFY_URL
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    delete process.env.NTFY_URL
  })

  it('POSTs to https://ntfy.sh/{topic} with message body', async () => {
    await sendNotification('my-topic', 'Hello world')

    expect(mockFetch).toHaveBeenCalledOnce()
    const [url, init] = mockFetch.mock.calls[0] as [string, RequestInit]
    expect(url).toBe('https://ntfy.sh/my-topic')
    expect(init.method).toBe('POST')
    expect(init.body).toBe('Hello world')
  })

  it('sets Title header when provided', async () => {
    await sendNotification('t', 'msg', { title: 'My Title' })

    const [, init] = mockFetch.mock.calls[0] as [string, RequestInit]
    expect((init.headers as Record<string, string>)['Title']).toBe('My Title')
  })

  it('sets Priority header when provided', async () => {
    await sendNotification('t', 'msg', { priority: 'high' })

    const [, init] = mockFetch.mock.calls[0] as [string, RequestInit]
    expect((init.headers as Record<string, string>)['Priority']).toBe('high')
  })

  it('sets Tags header as comma-separated string', async () => {
    await sendNotification('t', 'msg', { tags: ['warning', 'calendar'] })

    const [, init] = mockFetch.mock.calls[0] as [string, RequestInit]
    expect((init.headers as Record<string, string>)['Tags']).toBe('warning,calendar')
  })

  it('uses NTFY_URL env var when set', async () => {
    process.env.NTFY_URL = 'https://my-ntfy.example.com'
    await sendNotification('my-topic', 'msg')

    const [url] = mockFetch.mock.calls[0] as [string, RequestInit]
    expect(url).toBe('https://my-ntfy.example.com/my-topic')
  })

  it('does NOT throw when fetch rejects', async () => {
    mockFetch.mockRejectedValue(new Error('network error'))
    await expect(sendNotification('t', 'msg')).resolves.toBeUndefined()
  })

  it('logs error to console when fetch rejects', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    mockFetch.mockRejectedValue(new Error('network error'))

    await sendNotification('t', 'msg')

    expect(consoleSpy).toHaveBeenCalled()
    consoleSpy.mockRestore()
  })

  it('does not set Tags header when tags array is empty', async () => {
    await sendNotification('t', 'msg', { tags: [] })

    const [, init] = mockFetch.mock.calls[0] as [string, RequestInit]
    expect((init.headers as Record<string, string>)['Tags']).toBeUndefined()
  })
})

// ---------------------------------------------------------------------------
// wasNotifiedToday tests
// ---------------------------------------------------------------------------

describe('wasNotifiedToday', () => {
  it('returns true when stored date equals today', () => {
    const today = todayString()
    expect(wasNotifiedToday(today)).toBe(true)
  })

  it('returns false when stored date is a past date', () => {
    expect(wasNotifiedToday('2020-01-01')).toBe(false)
  })

  it('returns false when stored date is undefined', () => {
    expect(wasNotifiedToday(undefined)).toBe(false)
  })

  it('returns false when stored date is an empty string', () => {
    expect(wasNotifiedToday('')).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// wasNotifiedWithinDays tests
// ---------------------------------------------------------------------------

describe('wasNotifiedWithinDays', () => {
  it('returns true when stored date is today (within 7 days)', () => {
    expect(wasNotifiedWithinDays(todayString(), 7)).toBe(true)
  })

  it('returns false when stored date is undefined', () => {
    expect(wasNotifiedWithinDays(undefined, 7)).toBe(false)
  })

  it('returns false when stored date is far in the past', () => {
    expect(wasNotifiedWithinDays('2020-01-01', 7)).toBe(false)
  })
})
