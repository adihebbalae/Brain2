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

export type SummaryKind = 'overview' | 'current_state';

interface CacheEntry {
  summary: string;
  timestamp: number;
}

// In-memory cache: key = "kind:projectName:sourceId:fileMtime", value = { summary, timestamp }
const summaryCache = new Map<string, CacheEntry>();
const CACHE_TTL = 60 * 60 * 1000; // 1 hour in milliseconds

const OLLAMA_URL = process.env.OLLAMA_URL || 'http://localhost:11434';
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'llama3.1:8b';
const OLLAMA_KEEP_ALIVE = process.env.OLLAMA_KEEP_ALIVE || '30m';

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

function buildPrompt(kind: SummaryKind, structuredBrief: string): string {
  if (kind === 'overview') {
    return `The following are structured facts extracted from a project's README or overview file. Write a single paragraph (2-3 sentences) explaining what this project is, what it does, and why it exists. Be specific — use the exact names, technologies, and purposes from the facts. Do not invent anything not listed. If facts are sparse, say "Project overview has limited context."

Project facts:
${structuredBrief}`;
  }

  return `The following are structured facts extracted from a project's active task tracking file. Write a single paragraph (2-3 sentences) describing what is actively being worked on right now, the current progress or status, and any blockers or next priorities. Be specific — reference the exact task names and statuses from the facts. Do not invent anything not listed. If facts are sparse, say "Current state has limited context."

Project state facts:
${structuredBrief}`;
}

/**
 * Summarize project overview or current-state content using Ollama.
 * Returns cached result if still valid, otherwise fetches a new summary.
 */
export async function summarizeProjectAspect(
  projectName: string,
  sourceContent: string,
  sourceId: string,
  fileMtime: number,
  kind: SummaryKind
): Promise<SummaryResult> {
  const cacheKey = `${kind}:${projectName}:${sourceId}:${fileMtime}`;

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

  const truncatedContent = sourceContent.slice(0, 2000);
  const prompt = buildPrompt(kind, truncatedContent);

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
        keep_alive: OLLAMA_KEEP_ALIVE,
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

export async function summarizeProject(
  projectName: string,
  stateFileContent: string,
  fileMtime: number
): Promise<SummaryResult> {
  return summarizeProjectAspect(
    projectName,
    stateFileContent,
    'state-file',
    fileMtime,
    'current_state'
  );
}

/**
 * Clear the summary cache (useful for testing)
 */
export function clearCache(): void {
  summaryCache.clear();
}
