/**
 * Heuristic friction / quality insights over a bounded window of recent
 * sessions. Unlike the usage aggregator (metadata only), this reads full
 * transcripts, so it's capped to the most recent N sessions and each session's
 * friction is cached by file mtime. Only the small {@link InsightsReport}
 * aggregate crosses the IPC boundary.
 *
 * The signals are deliberately measurable proxies (tool errors, user
 * corrections, repeated tool calls) — not a judgement of answer quality.
 */

import { promises as fs } from 'node:fs'
import type { OsEnv } from '@/shared/types/agent'
import type {
  ChatMessage,
  ChatSessionMeta,
  InsightsDailyPoint,
  InsightsReport,
  SessionFriction,
} from '@/shared/types/chat'
import { getChatRuntime, hasChatRuntime } from './registry'
import { isUnderDir } from './paginate'

/** How many recent sessions to read transcripts for. */
const DEFAULT_LIMIT = 40
const TOP_FRICTION = 8

/** Lowercased user-turn openers / phrases that read like a correction. */
const CORRECTION_PATTERNS = [
  /^no\b/,
  /^nope\b/,
  /^stop\b/,
  /^wait\b/,
  /^actually\b/,
  /^don'?t\b/,
  /^undo\b/,
  /^revert\b/,
  /that'?s (not|wrong)/,
  /not what i/,
  /\binstead\b/,
  /\bwrong\b/,
]

interface CachedFriction {
  mtimeMs: number
  friction: SessionFriction
}

/** filePath → cached friction, per agent id. Survives across IPC calls. */
const cache = new Map<string, Map<string, CachedFriction>>()

function firstText(message: ChatMessage): string {
  for (const block of message.blocks) {
    if (block.kind === 'text') return block.text
  }
  return ''
}

function looksLikeCorrection(text: string): boolean {
  const t = text.trim().toLowerCase()
  if (!t || t.length > 240) return false
  return CORRECTION_PATTERNS.some((re) => re.test(t))
}

/** Compute a session's friction signals from its full transcript. */
export function frictionForTranscript(
  meta: ChatSessionMeta,
  messages: ChatMessage[],
): SessionFriction {
  let toolCalls = 0
  let toolErrors = 0
  let corrections = 0
  let redundantCalls = 0
  const seenCalls = new Set<string>()

  for (const m of messages) {
    if (m.role === 'user' && looksLikeCorrection(firstText(m))) corrections += 1
    for (const block of m.blocks) {
      if (block.kind === 'tool_use') {
        toolCalls += 1
        const sig = `${block.name}:${JSON.stringify(block.input)}`
        if (seenCalls.has(sig)) redundantCalls += 1
        else seenCalls.add(sig)
      } else if (block.kind === 'tool_result' && block.isError) {
        toolErrors += 1
      }
    }
  }

  const score = Math.min(
    100,
    corrections * 14 + toolErrors * 9 + redundantCalls * 5,
  )

  return {
    sessionId: meta.id,
    title: meta.title,
    projectLabel: meta.projectLabel,
    updatedAt: meta.updatedAt,
    messages: messages.length,
    toolCalls,
    toolErrors,
    corrections,
    redundantCalls,
    score,
  }
}

async function frictionForSession(
  env: OsEnv,
  agentId: string,
  meta: ChatSessionMeta,
): Promise<SessionFriction | null> {
  let agentCache = cache.get(agentId)
  if (!agentCache) {
    agentCache = new Map()
    cache.set(agentId, agentCache)
  }

  let mtimeMs: number | null = null
  try {
    mtimeMs = (await fs.stat(meta.filePath)).mtimeMs
  } catch {
    // File vanished between listing and stat — skip the mtime cache for it.
  }
  if (mtimeMs !== null) {
    const hit = agentCache.get(meta.filePath)
    if (hit && hit.mtimeMs === mtimeMs) return hit.friction
  }

  const transcript = await getChatRuntime(agentId)
    .readSession(env, meta.id)
    .catch(() => null)
  if (!transcript) return null
  const friction = frictionForTranscript(meta, transcript.messages)
  if (mtimeMs !== null) agentCache.set(meta.filePath, { mtimeMs, friction })
  return friction
}

function emptyReport(): InsightsReport {
  return {
    sessionsAnalyzed: 0,
    avgScore: 0,
    totalToolCalls: 0,
    totalToolErrors: 0,
    totalCorrections: 0,
    totalRedundantCalls: 0,
    buckets: { smooth: 0, some: 0, high: 0 },
    topFriction: [],
    daily: [],
  }
}

export async function computeInsights(
  env: OsEnv,
  agentId: string,
  opts?: { cwd?: string; limit?: number },
): Promise<InsightsReport> {
  if (!hasChatRuntime(agentId)) return emptyReport()

  const limit = Math.max(1, Math.min(opts?.limit ?? DEFAULT_LIMIT, 200))
  const page = await getChatRuntime(agentId).listSessions(env, {
    limit,
    cwd: opts?.cwd,
  })
  const metas = opts?.cwd
    ? page.sessions.filter((m) => isUnderDir(m.cwd, opts.cwd!))
    : page.sessions
  if (metas.length === 0) return emptyReport()

  const results = await Promise.all(
    metas.map((meta) => frictionForSession(env, agentId, meta)),
  )
  const frictions = results.filter((f): f is SessionFriction => f !== null)
  if (frictions.length === 0) return emptyReport()

  let totalToolCalls = 0
  let totalToolErrors = 0
  let totalCorrections = 0
  let totalRedundantCalls = 0
  let scoreSum = 0
  const buckets = { smooth: 0, some: 0, high: 0 }
  const byDay = new Map<string, { sum: number; count: number }>()

  for (const f of frictions) {
    totalToolCalls += f.toolCalls
    totalToolErrors += f.toolErrors
    totalCorrections += f.corrections
    totalRedundantCalls += f.redundantCalls
    scoreSum += f.score
    if (f.score < 20) buckets.smooth += 1
    else if (f.score < 50) buckets.some += 1
    else buckets.high += 1
    if (f.updatedAt) {
      const day = f.updatedAt.slice(0, 10)
      const acc = byDay.get(day) ?? { sum: 0, count: 0 }
      acc.sum += f.score
      acc.count += 1
      byDay.set(day, acc)
    }
  }

  const daily: InsightsDailyPoint[] = [...byDay.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([date, { sum, count }]) => ({
      date,
      score: Math.round(sum / count),
      sessions: count,
    }))

  const topFriction = [...frictions]
    .sort((a, b) => b.score - a.score)
    .slice(0, TOP_FRICTION)
    .filter((f) => f.score > 0)

  return {
    sessionsAnalyzed: frictions.length,
    avgScore: Math.round(scoreSum / frictions.length),
    totalToolCalls,
    totalToolErrors,
    totalCorrections,
    totalRedundantCalls,
    buckets,
    topFriction,
    daily,
  }
}
