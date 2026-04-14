/**
 * Tests for Ollama client
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { getOllamaStatus, summarizeProject, clearCache } from './ollama-client.js';

describe('Ollama Client', () => {
  beforeEach(() => {
    clearCache();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe('getOllamaStatus', () => {
    it('returns available: true when fetch succeeds', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({}),
      }));

      const status = await getOllamaStatus();

      expect(status.available).toBe(true);
      expect(status.model).toBe('llama3.1:8b');
      expect(status.url).toBe('http://localhost:11434');
    });

    it('returns available: false when fetch throws (connection refused)', async () => {
      vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Connection refused')));

      const status = await getOllamaStatus();

      expect(status.available).toBe(false);
      expect(status.model).toBe('llama3.1:8b');
      expect(status.url).toBe('http://localhost:11434');
    });

    it('returns available: false when response is not ok', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
      }));

      const status = await getOllamaStatus();

      expect(status.available).toBe(false);
    });

    it('times out after 3 seconds', async () => {
      vi.stubGlobal('fetch', vi.fn().mockImplementation(
        () => new Promise((resolve) => setTimeout(resolve, 5000))
      ));

      const status = await getOllamaStatus();

      expect(status.available).toBe(false);
    });
  });

  describe('summarizeProject', () => {
    it('returns cached result on second call with same key', async () => {
      const mockResponse = {
        ok: true,
        json: async () => ({ response: 'Test summary from Ollama' }),
      };

      vi.stubGlobal('fetch', vi.fn()
        .mockResolvedValueOnce({ ok: true, json: async () => ({}) }) // getOllamaStatus
        .mockResolvedValueOnce(mockResponse) // first summarize call
        .mockResolvedValueOnce({ ok: true, json: async () => ({}) }) // second getOllamaStatus
      );

      const firstResult = await summarizeProject('TestProject', 'State content', 12345);
      expect(firstResult.summary).toBe('Test summary from Ollama');
      expect(firstResult.cached).toBe(false);

      const secondResult = await summarizeProject('TestProject', 'State content', 12345);
      expect(secondResult.summary).toBe('Test summary from Ollama');
      expect(secondResult.cached).toBe(true);

      // Verify fetch was called only twice (status check + first summarize, no second summarize)
      expect(fetch).toHaveBeenCalledTimes(2);
    });

    it('returns summary: null when Ollama unavailable', async () => {
      vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Connection refused')));

      const result = await summarizeProject('TestProject', 'State content', 12345);

      expect(result.summary).toBe(null);
      expect(result.cached).toBe(false);
      expect(result.error).toBe('Ollama not available');
    });

    it('truncates state file content to 2000 characters', async () => {
      const longContent = 'x'.repeat(3000);
      let capturedPrompt = '';

      vi.stubGlobal('fetch', vi.fn()
        .mockResolvedValueOnce({ ok: true, json: async () => ({}) }) // getOllamaStatus
        .mockImplementationOnce(async (_url, options: any) => {
          const body = JSON.parse(options.body);
          capturedPrompt = body.prompt;
          return {
            ok: true,
            json: async () => ({ response: 'Summary' }),
          };
        })
      );

      await summarizeProject('TestProject', longContent, 12345);

      // The prompt should contain truncated content (2000 chars of 'x')
      expect(capturedPrompt).toContain('x'.repeat(2000));
      expect(capturedPrompt).not.toContain('x'.repeat(2001));
    });

    it('returns error when Ollama API fails', async () => {
      vi.stubGlobal('fetch', vi.fn()
        .mockResolvedValueOnce({ ok: true, json: async () => ({}) }) // getOllamaStatus
        .mockResolvedValueOnce({ ok: false, status: 500 }) // summarize call fails
      );

      const result = await summarizeProject('TestProject', 'State content', 12345);

      expect(result.summary).toBe(null);
      expect(result.cached).toBe(false);
      expect(result.error).toContain('Ollama API error');
    });

    it('cache expires after 1 hour', async () => {
      vi.useFakeTimers();

      const mockResponse = {
        ok: true,
        json: async () => ({ response: 'Test summary' }),
      };

      vi.stubGlobal('fetch', vi.fn()
        .mockResolvedValueOnce({ ok: true, json: async () => ({}) }) // first getOllamaStatus
        .mockResolvedValueOnce(mockResponse) // first summarize
        .mockResolvedValueOnce({ ok: true, json: async () => ({}) }) // second getOllamaStatus after cache expires
        .mockResolvedValueOnce(mockResponse) // second summarize after cache expires
      );

      // First call - caches result
      const firstResult = await summarizeProject('TestProject', 'State content', 12345);
      expect(firstResult.cached).toBe(false);

      // Advance time by 1 hour + 1 second
      vi.advanceTimersByTime(60 * 60 * 1000 + 1000);

      // Second call - cache should be expired
      const secondResult = await summarizeProject('TestProject', 'State content', 12345);
      expect(secondResult.cached).toBe(false);

      // Verify fetch was called 4 times (2 status checks + 2 summarize calls)
      expect(fetch).toHaveBeenCalledTimes(4);

      vi.useRealTimers();
    });

    it('different mtime creates new cache entry', async () => {
      const mockResponse = {
        ok: true,
        json: async () => ({ response: 'Test summary' }),
      };

      vi.stubGlobal('fetch', vi.fn()
        .mockResolvedValueOnce({ ok: true, json: async () => ({}) }) // first getOllamaStatus
        .mockResolvedValueOnce(mockResponse) // first summarize
        .mockResolvedValueOnce({ ok: true, json: async () => ({}) }) // second getOllamaStatus
        .mockResolvedValueOnce(mockResponse) // second summarize with different mtime
      );

      const firstResult = await summarizeProject('TestProject', 'State content', 12345);
      expect(firstResult.cached).toBe(false);

      // Same project but different mtime (file was modified)
      const secondResult = await summarizeProject('TestProject', 'State content', 67890);
      expect(secondResult.cached).toBe(false);

      // Verify fetch was called 4 times (2 status checks + 2 summarize calls)
      expect(fetch).toHaveBeenCalledTimes(4);
    });

    it('handles timeout gracefully', async () => {
      // Mock an AbortError that would be thrown when the request times out
      const abortError = new Error('The operation was aborted');
      abortError.name = 'AbortError';

      vi.stubGlobal('fetch', vi.fn()
        .mockResolvedValueOnce({ ok: true, json: async () => ({}) }) // getOllamaStatus
        .mockRejectedValueOnce(abortError) // timeout/abort
      );

      const result = await summarizeProject('TestProject', 'State content', 12345);

      expect(result.summary).toBe(null);
      expect(result.cached).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('sends correct prompt format to Ollama', async () => {
      let capturedBody: any;

      vi.stubGlobal('fetch', vi.fn()
        .mockResolvedValueOnce({ ok: true, json: async () => ({}) }) // getOllamaStatus
        .mockImplementationOnce(async (_url, options: any) => {
          capturedBody = JSON.parse(options.body);
          return {
            ok: true,
            json: async () => ({ response: 'Summary' }),
          };
        })
      );

      await summarizeProject('TestProject', 'My state content', 12345);

      expect(capturedBody.model).toBe('llama3.1:8b');
      expect(capturedBody.stream).toBe(false);
      expect(capturedBody.prompt).toContain('My state content');
      expect(capturedBody.prompt).toContain('Where did I leave off?');
      expect(capturedBody.prompt).toContain('Be specific and actionable');
    });
  });
});
