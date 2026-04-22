/**
 * Ollama client for local AI summarization
 * Uses llama3.1:8b model at http://localhost:11434
 */

export interface OllamaStatus {
  available: boolean;
  model: string;
  url: string;
}

export interface SummaryResult {
  summary: string | null;
  cached: boolean;
  error?: string;
}

interface CacheEntry {
  summary: string;
  timestamp: number;
}

// In-memory cache: key = "projectName:fileMtime", value = { summary, timestamp }
const summaryCache = new Map<string, CacheEntry>();
const CACHE_TTL = 60 * 60 * 1000; // 1 hour in milliseconds

const OLLAMA_URL = process.env.OLLAMA_URL || 'http://localhost:11434';
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'llama3.1:8b';

/**
 * Check if Ollama is available at the configured URL
 */
export async function getOllamaStatus(): Promise<OllamaStatus> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000); // 3 second timeout

    const response = await fetch(`${OLLAMA_URL}/api/tags`, {
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (response.ok) {
      return {
        available: true,
        model: OLLAMA_MODEL,
        url: OLLAMA_URL,
      };
    }

    return {
      available: false,
      model: OLLAMA_MODEL,
      url: OLLAMA_URL,
    };
  } catch (error) {
    return {
      available: false,
      model: OLLAMA_MODEL,
      url: OLLAMA_URL,
    };
  }
}

/**
 * Summarize a project state file using Ollama
 * Returns cached result if still valid, otherwise fetches new summary
 */
export async function summarizeProject(
  projectName: string,
  stateFileContent: string,
  fileMtime: number
): Promise<SummaryResult> {
  const cacheKey = `${projectName}:${fileMtime}`;

  // Check cache first
  const cached = summaryCache.get(cacheKey);
  if (cached) {
    const age = Date.now() - cached.timestamp;
    if (age < CACHE_TTL) {
      return {
        summary: cached.summary,
        cached: true,
      };
    } else {
      // Cache expired, remove it
      summaryCache.delete(cacheKey);
    }
  }

  // Check if Ollama is available
  const status = await getOllamaStatus();
  if (!status.available) {
    return {
      summary: null,
      cached: false,
      error: 'Ollama not available',
    };
  }

  // Truncate state file content to 2000 characters
  const truncatedContent = stateFileContent.slice(0, 2000);

  // Build prompt
  const prompt = `You are reading a project state file. In 2-3 sentences, describe exactly where the developer left off based ONLY on what is written in this file. Do not invent details. Do not guess. If the file doesn't have enough information, say "State file has limited context." Be concise and direct.

State file content:
${truncatedContent}`;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000); // 30 second timeout

    const response = await fetch(`${OLLAMA_URL}/api/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: OLLAMA_MODEL,
        prompt,
        stream: false,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!response.ok) {
      if (response.status === 404) {
        console.error('[ollama] Model not found (404). Run: ollama pull llama3.1:8b');
        return {
          summary: null,
          cached: false,
          error: 'model_not_found',
        };
      }
      return {
        summary: null,
        cached: false,
        error: `Ollama API error: ${response.status}`,
      };
    }

    const data = await response.json();
    const summary = data.response?.trim() || null;

    if (summary) {
      // Cache the result
      summaryCache.set(cacheKey, {
        summary,
        timestamp: Date.now(),
      });
    }

    return {
      summary,
      cached: false,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return {
      summary: null,
      cached: false,
      error: errorMessage,
    };
  }
}

/**
 * Clear the summary cache (useful for testing)
 */
export function clearCache(): void {
  summaryCache.clear();
}
