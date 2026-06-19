/**
 * Claude subscription plan-usage lookup.
 *
 * Mirrors what the `claude` CLI's own `/usage` view shows: the rolling session
 * window plus weekly windows (all models, Sonnet, Opus). Abyss never stores
 * tokens — it reads the CLI's credential store (`~/.claude/.credentials.json`)
 * and calls the same OAuth usage endpoint the CLI uses, with the user's own
 * access token. Lives in `core/` (main-process only) because it needs network +
 * fs; the renderer reaches it through typed IPC.
 */

import type { OsEnv } from '@/shared/types/agent'
import type {
  PlanUsage,
  PlanUsageResult,
  PlanUsageWindow,
} from '@/shared/types/chat'
import { readClaudeCredentials } from './auth'

const USAGE_ENDPOINT = 'https://api.anthropic.com/api/oauth/usage'
const OAUTH_BETA = 'oauth-2025-04-20'
/** Identifies this OAuth client to the endpoint; mirrors the CLI's UA shape. */
const USER_AGENT = 'claude-cli (external, abyss)'
const REQUEST_TIMEOUT_MS = 8000
/** Short cache so re-opening the panel doesn't re-hit the endpoint each time. */
const CACHE_TTL_MS = 20_000

/** Raw shape of the `/api/oauth/usage` response (snake_case from the API). */
interface RawWindow {
  utilization?: number
  resets_at?: string
}
interface RawUsageResponse {
  five_hour?: RawWindow
  seven_day?: RawWindow
  seven_day_opus?: RawWindow
  seven_day_sonnet?: RawWindow
}

function toWindow(raw: RawWindow | undefined): PlanUsageWindow | undefined {
  if (!raw || typeof raw.utilization !== 'number') return undefined
  return {
    utilization: Math.max(0, Math.min(1, raw.utilization)),
    resetsAt: typeof raw.resets_at === 'string' ? raw.resets_at : undefined,
  }
}

let cache: { at: number; result: PlanUsageResult } | null = null

/**
 * Returns the current plan-usage snapshot. Cached for {@link CACHE_TTL_MS};
 * pass `force` (the manual refresh button) to bypass the cache. Transient
 * failures are never cached, so a retry can recover immediately.
 */
export async function getClaudePlanUsage(
  env: OsEnv,
  opts?: { force?: boolean },
): Promise<PlanUsageResult> {
  if (!opts?.force && cache && Date.now() - cache.at < CACHE_TTL_MS) {
    return cache.result
  }
  const result = await fetchClaudePlanUsage(env)
  if (result.status !== 'unavailable') cache = { at: Date.now(), result }
  return result
}

async function fetchClaudePlanUsage(env: OsEnv): Promise<PlanUsageResult> {
  const creds = await readClaudeCredentials(env)
  const oauth = creds.claudeAiOauth
  const token = oauth?.accessToken
  if (!token) return { status: 'unauthenticated' }
  // The CLI refreshes access tokens lazily; once expired we can't mint one here.
  if (oauth?.expiresAt && oauth.expiresAt <= Date.now()) {
    return { status: 'unauthenticated' }
  }

  let res: Response
  try {
    res = await fetch(USAGE_ENDPOINT, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        'anthropic-beta': OAUTH_BETA,
        'User-Agent': USER_AGENT,
      },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    })
  } catch (err) {
    return {
      status: 'unavailable',
      reason: err instanceof Error ? err.message : 'Network request failed',
    }
  }

  if (res.status === 401 || res.status === 403) {
    return { status: 'unauthenticated' }
  }
  if (!res.ok) {
    return {
      status: 'unavailable',
      reason: `Usage request failed (HTTP ${res.status})`,
    }
  }

  let raw: RawUsageResponse
  try {
    raw = (await res.json()) as RawUsageResponse
  } catch {
    return { status: 'unavailable', reason: 'Malformed usage response' }
  }

  const usage: PlanUsage = {
    subscriptionType: oauth?.subscriptionType,
    session: toWindow(raw.five_hour),
    weeklyAllModels: toWindow(raw.seven_day),
    weeklySonnet: toWindow(raw.seven_day_sonnet),
    weeklyOpus: toWindow(raw.seven_day_opus),
    fetchedAt: new Date().toISOString(),
  }
  return { status: 'ok', usage }
}
