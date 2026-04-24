import { getGitActivity, type GitActivityData } from './git-activity-parser.js'

const CACHE_TTL_MS = 10 * 60 * 1000

let cachedData: GitActivityData | null = null
let cacheTimestamp = 0
let inFlightRequest: Promise<GitActivityData> | null = null

export async function getCachedGitActivity(projectsDir: string): Promise<GitActivityData> {
  const now = Date.now()
  if (cachedData && (now - cacheTimestamp) < CACHE_TTL_MS) {
    return cachedData
  }

  if (inFlightRequest) {
    return inFlightRequest
  }

  inFlightRequest = getGitActivity(projectsDir)
    .then(data => {
      cachedData = data
      cacheTimestamp = Date.now()
      return data
    })
    .finally(() => {
      inFlightRequest = null
    })

  return inFlightRequest
}

export function clearGitActivityCache(): void {
  cachedData = null
  cacheTimestamp = 0
  inFlightRequest = null
}
