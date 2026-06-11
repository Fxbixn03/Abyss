/**
 * Cached usage aggregation. Listing every transcript on each dashboard mount or
 * agent switch is the slow path, so each file's metadata is parsed once and
 * cached by mtime — subsequent calls only re-read files that actually changed.
 * Only the small {@link ChatUsageStats} aggregate crosses the IPC boundary,
 * never the full session list.
 */

import { promises as fs } from 'node:fs'
import type { AgentId, OsEnv } from '@/shared/types/agent'
import type {
  ChatListOptions,
  ChatSessionMeta,
  ChatUsageStats,
  UsageAgentStat,
  UsageAnalytics,
  UsageDailyPoint,
  UsageProjectStat,
} from '@/shared/types/chat'
import { estimateCostUsd } from '@/shared/lib/cost'
import { getChatRuntime, hasChatRuntime } from './registry'
import { isUnderDir } from './paginate'

const FIVE_HOURS_MS = 5 * 60 * 60 * 1000
const TREND_DAYS = 7

interface CachedMeta {
  mtimeMs: number
  meta: ChatSessionMeta | null
}

/** filePath → cached meta, keyed per agent id. Survives across IPC calls. */
const cache = new Map<string, Map<string, CachedMeta>>()

/** Token totals per calendar day for the last `n` days (oldest first). */
function lastDays(n: number, byDay: Map<string, number>): UsageDailyPoint[] {
  const out: UsageDailyPoint[] = []
  const today = new Date()
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(today)
    d.setUTCDate(d.getUTCDate() - i)
    const date = d.toISOString().slice(0, 10)
    out.push({ date, tokens: byDay.get(date) ?? 0 })
  }
  return out
}

function emptyStats(): ChatUsageStats {
  return {
    totalSessions: 0,
    totalMessages: 0,
    inputTokens: 0,
    outputTokens: 0,
    sessionTokens: 0,
    recent: [],
    topProjects: [],
    daily: lastDays(TREND_DAYS, new Map()),
    estCostUsd: 0,
  }
}

/** Parse (or reuse cached) metadata for every transcript of one agent. */
async function collectMetas(
  env: OsEnv,
  agentId: string,
): Promise<ChatSessionMeta[]> {
  if (!hasChatRuntime(agentId)) return []
  const source = getChatRuntime(agentId).usage
  if (!source) return []

  const files = await source.listFiles(env)
  let agentCache = cache.get(agentId)
  if (!agentCache) {
    agentCache = new Map()
    cache.set(agentId, agentCache)
  }

  const seen = new Set<string>()
  const metas = await Promise.all(
    files.map(async (ref) => {
      seen.add(ref.filePath)
      let mtimeMs: number
      try {
        mtimeMs = (await fs.stat(ref.filePath)).mtimeMs
      } catch {
        return null
      }
      const hit = agentCache!.get(ref.filePath)
      if (hit && hit.mtimeMs === mtimeMs) return hit.meta
      const meta = await source.readMeta(ref).catch(() => null)
      agentCache!.set(ref.filePath, { mtimeMs, meta })
      return meta
    }),
  )

  // Evict cache entries for files that have since been deleted.
  for (const key of [...agentCache.keys()]) {
    if (!seen.has(key)) agentCache.delete(key)
  }

  return metas.filter((m): m is ChatSessionMeta => m !== null)
}

export async function computeUsageStats(
  env: OsEnv,
  agentId: string,
  opts?: ChatListOptions,
): Promise<ChatUsageStats> {
  const all = await collectMetas(env, agentId)
  const metas = opts?.cwd
    ? all.filter((m) => isUnderDir(m.cwd, opts.cwd!))
    : all
  if (metas.length === 0) return emptyStats()

  let totalMessages = 0
  let inputTokens = 0
  let outputTokens = 0
  let sessionTokens = 0
  const since5h = Date.now() - FIVE_HOURS_MS
  const projects = new Map<string, number>()
  const byDay = new Map<string, number>()

  for (const m of metas) {
    const tokens = (m.inputTokens ?? 0) + (m.outputTokens ?? 0)
    totalMessages += m.messageCount
    inputTokens += m.inputTokens ?? 0
    outputTokens += m.outputTokens ?? 0
    projects.set(
      m.projectLabel,
      (projects.get(m.projectLabel) ?? 0) + m.messageCount,
    )
    if (m.updatedAt) {
      const t = new Date(m.updatedAt).getTime()
      if (t >= since5h) sessionTokens += tokens
      const day = m.updatedAt.slice(0, 10)
      byDay.set(day, (byDay.get(day) ?? 0) + tokens)
    }
  }

  const recent = [...metas]
    .sort((a, b) => (b.updatedAt ?? '').localeCompare(a.updatedAt ?? ''))
    .slice(0, 6)
  const topProjects = [...projects.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([label, messageCount]) => ({ label, messageCount }))

  return {
    totalSessions: metas.length,
    totalMessages,
    inputTokens,
    outputTokens,
    sessionTokens,
    recent,
    topProjects,
    daily: lastDays(TREND_DAYS, byDay),
    estCostUsd: estimateCostUsd(inputTokens, outputTokens),
  }
}

/** Clamp the analytics window to a sane range so the daily series stays bounded. */
const MIN_ANALYTICS_DAYS = 7
const MAX_ANALYTICS_DAYS = 365

interface ProjectAccum {
  label: string
  cwd: string
  sessions: number
  messages: number
  inputTokens: number
  outputTokens: number
}

/**
 * Cross-agent usage analytics for the dedicated Analytics page. Aggregates the
 * same mtime-cached transcript metadata used by {@link computeUsageStats} across
 * every requested agent, producing per-day, per-agent and per-project rollups
 * plus overall totals. Only the small aggregate crosses the IPC boundary.
 */
export async function computeUsageAnalytics(
  env: OsEnv,
  agentIds: AgentId[],
  opts?: { cwd?: string; days?: number },
): Promise<UsageAnalytics> {
  const days = Math.min(
    Math.max(Math.round(opts?.days ?? 30), MIN_ANALYTICS_DAYS),
    MAX_ANALYTICS_DAYS,
  )
  const sinceDay = (() => {
    const d = new Date()
    d.setUTCDate(d.getUTCDate() - (days - 1))
    return d.toISOString().slice(0, 10)
  })()

  let totalSessions = 0
  let totalMessages = 0
  let inputTokens = 0
  let outputTokens = 0
  let lastActivityAt: string | undefined
  const byDay = new Map<string, number>()
  const byAgent: UsageAgentStat[] = []
  const projects = new Map<string, ProjectAccum>()

  for (const agentId of agentIds) {
    const all = await collectMetas(env, agentId)
    const metas = opts?.cwd
      ? all.filter((m) => isUnderDir(m.cwd, opts.cwd!))
      : all
    if (metas.length === 0) continue

    let aIn = 0
    let aOut = 0
    let aMessages = 0
    for (const m of metas) {
      const mIn = m.inputTokens ?? 0
      const mOut = m.outputTokens ?? 0
      aIn += mIn
      aOut += mOut
      aMessages += m.messageCount
      totalMessages += m.messageCount
      inputTokens += mIn
      outputTokens += mOut

      if (m.updatedAt) {
        if (!lastActivityAt || m.updatedAt > lastActivityAt) {
          lastActivityAt = m.updatedAt
        }
        const day = m.updatedAt.slice(0, 10)
        if (day >= sinceDay) {
          byDay.set(day, (byDay.get(day) ?? 0) + mIn + mOut)
        }
      }

      const key = m.cwd || m.projectLabel
      const acc = projects.get(key) ?? {
        label: m.projectLabel,
        cwd: m.cwd,
        sessions: 0,
        messages: 0,
        inputTokens: 0,
        outputTokens: 0,
      }
      acc.sessions += 1
      acc.messages += m.messageCount
      acc.inputTokens += mIn
      acc.outputTokens += mOut
      projects.set(key, acc)
    }

    totalSessions += metas.length
    byAgent.push({
      agentId,
      sessions: metas.length,
      messages: aMessages,
      inputTokens: aIn,
      outputTokens: aOut,
      estCostUsd: estimateCostUsd(aIn, aOut),
    })
  }

  byAgent.sort(
    (a, b) =>
      b.inputTokens + b.outputTokens - (a.inputTokens + a.outputTokens),
  )

  const projectStats: UsageProjectStat[] = [...projects.values()]
    .map((p) => ({
      label: p.label,
      cwd: p.cwd,
      sessions: p.sessions,
      messages: p.messages,
      inputTokens: p.inputTokens,
      outputTokens: p.outputTokens,
      estCostUsd: estimateCostUsd(p.inputTokens, p.outputTokens),
    }))
    .sort(
      (a, b) =>
        b.inputTokens + b.outputTokens - (a.inputTokens + a.outputTokens),
    )
    .slice(0, 12)

  return {
    totalSessions,
    totalMessages,
    inputTokens,
    outputTokens,
    estCostUsd: estimateCostUsd(inputTokens, outputTokens),
    daily: lastDays(days, byDay),
    byAgent,
    projects: projectStats,
    days,
    lastActivityAt,
  }
}
