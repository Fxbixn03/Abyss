/**
 * Normalized chat model — the "open standard" every agent maps onto.
 *
 * These are pure types (no Node, no React) so the renderer, the Electron main
 * process and the per-agent runtimes in `core/chat` all share one contract. A
 * new agent only has to translate its native on-disk / streaming format into
 * these shapes; the UI never changes.
 */

import type { AgentId } from './agent'

export type ChatRole = 'user' | 'assistant' | 'system'

/**
 * One renderable piece of a message. Discriminated on `kind` so the transcript
 * can render a dedicated component per block without knowing the agent.
 */
export type ChatBlock =
  | { kind: 'text'; text: string }
  | { kind: 'thinking'; text: string }
  | { kind: 'tool_use'; id: string; name: string; input: unknown }
  | {
      kind: 'tool_result'
      toolUseId: string
      output: string
      isError?: boolean
    }
  | { kind: 'image'; mime: string; /** path or data URI */ source: string }
  | { kind: 'error'; message: string }

export interface ChatMessage {
  /** Stable id (the agent's message/event uuid where available). */
  id: string
  role: ChatRole
  blocks: ChatBlock[]
  /** ISO 8601, when known. */
  timestamp?: string
  model?: string
  /** Sub-agent / sidechain turn (Claude). Rendered subtly indented. */
  isSidechain?: boolean
}

/** Lightweight metadata for the session list (cheap to compute, no full parse). */
export interface ChatSessionMeta {
  /** Agent-native session id (Claude sessionId, Codex rollout id, …). */
  id: string
  agentId: AgentId
  /** Best-effort human title (first user prompt or a summary event). */
  title: string
  /** Decoded working directory the session ran in. */
  cwd: string
  /** Display label for the project group (basename of cwd or the raw folder). */
  projectLabel: string
  gitBranch?: string
  messageCount: number
  /** ISO 8601. */
  startedAt?: string
  updatedAt?: string
  sizeBytes: number
  /** Token totals across the session, when the agent records them. */
  inputTokens?: number
  outputTokens?: number
  /** Absolute path of the backing transcript file. */
  filePath: string
}

export interface ChatTranscript extends ChatSessionMeta {
  messages: ChatMessage[]
}

/** Pagination + filtering options for listing sessions (infinite scroll). */
export interface ChatListOptions {
  /** Number of (recency-ordered) sessions to skip. */
  offset?: number
  /** Max sessions to return; omit for all. */
  limit?: number
  /** Only sessions whose working directory is under this project dir. */
  cwd?: string
}

/** A page of session metadata plus the total matching the filter. */
export interface ChatSessionPage {
  sessions: ChatSessionMeta[]
  /** Total sessions matching the filter, across all pages. */
  total: number
}

/** One calendar day's token total for the usage trend (last 7 days). */
export interface UsageDailyPoint {
  /** Calendar day, YYYY-MM-DD (UTC). */
  date: string
  tokens: number
}

/** A project ranked by message volume in the usage overview. */
export interface UsageProjectCount {
  label: string
  messageCount: number
}

/**
 * Pre-aggregated chat usage for the dashboard. Computed in `core/chat/usage.ts`
 * and cached per agent by transcript mtime, so only this small aggregate crosses
 * the IPC boundary — never the full session list.
 */
export interface ChatUsageStats {
  totalSessions: number
  totalMessages: number
  inputTokens: number
  outputTokens: number
  /** Tokens across sessions touched within the rolling last 5 hours. */
  sessionTokens: number
  /** Most-recently updated sessions (max 6). */
  recent: ChatSessionMeta[]
  /** Busiest projects by message count (max 5). */
  topProjects: UsageProjectCount[]
  /** Token totals per calendar day for the last 7 days (oldest first). */
  daily: UsageDailyPoint[]
  /** Rough cost estimate from token totals (USD); always an estimate. */
  estCostUsd?: number
  /** Real cost in USD when the agent records it; absent for history-only. */
  realCostUsd?: number
}

/** One project's aggregated usage, ranked in the analytics view by tokens. */
export interface UsageProjectStat {
  /** Display label (basename of the working directory). */
  label: string
  /** Absolute working directory the sessions ran in. */
  cwd: string
  sessions: number
  messages: number
  inputTokens: number
  outputTokens: number
  estCostUsd: number
}

/** One agent's aggregated usage in the cross-agent analytics view. */
export interface UsageAgentStat {
  agentId: AgentId
  sessions: number
  messages: number
  inputTokens: number
  outputTokens: number
  estCostUsd: number
}

/**
 * Rich, multi-agent usage aggregate for the dedicated Analytics page. Computed
 * in `core/chat/usage.ts` from the same mtime-cached transcript metadata that
 * backs the dashboard panel — only this aggregate crosses the IPC boundary.
 */
export interface UsageAnalytics {
  totalSessions: number
  totalMessages: number
  inputTokens: number
  outputTokens: number
  estCostUsd: number
  /** Token totals per calendar day across the requested window (oldest first). */
  daily: UsageDailyPoint[]
  /** Per-agent breakdown, busiest first. */
  byAgent: UsageAgentStat[]
  /** Per-project breakdown, highest token use first. */
  projects: UsageProjectStat[]
  /** Length of the `daily` window, in days. */
  days: number
  /** ISO timestamp of the most recent activity across all agents, if any. */
  lastActivityAt?: string
}

/**
 * Per-session friction signals, derived heuristically from a transcript. These
 * are measurable proxies — not a judgement of answer quality — surfaced by the
 * Insights view to flag where a session got rough.
 */
export interface SessionFriction {
  sessionId: string
  title: string
  projectLabel: string
  updatedAt?: string
  messages: number
  toolCalls: number
  /** `tool_result` blocks flagged `isError`. */
  toolErrors: number
  /** User turns that read like a correction ("no", "actually", "undo", …). */
  corrections: number
  /** Identical tool calls (same name + input) repeated within the session. */
  redundantCalls: number
  /** 0–100 heuristic friction score; higher means more friction. */
  score: number
}

/** One day's average friction across the analyzed sessions (trend line). */
export interface InsightsDailyPoint {
  date: string
  score: number
  sessions: number
}

/**
 * Aggregate friction / quality report over a bounded window of recent sessions.
 * Computed in `core/chat/insights.ts` (full transcripts, mtime-cached); only
 * this small aggregate crosses the IPC boundary.
 */
export interface InsightsReport {
  sessionsAnalyzed: number
  /** Mean friction score across analyzed sessions (0–100). */
  avgScore: number
  totalToolCalls: number
  totalToolErrors: number
  totalCorrections: number
  totalRedundantCalls: number
  /** Distribution of sessions by friction band. */
  buckets: { smooth: number; some: number; high: number }
  /** Roughest sessions first, capped. */
  topFriction: SessionFriction[]
  /** Friction trend over the window (oldest first). */
  daily: InsightsDailyPoint[]
}

/** Whether an agent's CLI is installed and (for live chat) logged in. */
export interface ChatAvailability {
  /** CLI binary found on PATH / resolvable. */
  installed: boolean
  /** A usable auth session exists (subscription login or API key). */
  authenticated: boolean
  /** Human-readable account label when authenticated, e.g. an email. */
  account?: string
  /** Why it is unavailable, for a friendly empty state. */
  reason?: string
}

/** How tools are auto-approved while the agent runs. Safe default = 'default'. */
export type ChatPermissionMode =
  | 'default'
  | 'acceptEdits'
  | 'plan'
  | 'bypassPermissions'

export interface ChatStartOptions {
  agentId: AgentId
  /** Resume an existing on-disk session; omit to start fresh. */
  resumeSessionId?: string
  /** Working directory the agent runs in. */
  cwd: string
  model?: string
  permissionMode: ChatPermissionMode
  /** Optional API key; when absent the runtime uses the CLI's subscription login. */
  apiKey?: string
}

/**
 * Normalized streaming events pushed main → renderer for a live turn. Every
 * runtime emits this union; the UI dispatches on `t`.
 */
export type ChatStreamEvent =
  | { t: 'session_init'; sessionId: string; model?: string; cwd?: string }
  | { t: 'message_start'; role: ChatRole; messageId: string }
  | { t: 'text_delta'; text: string }
  | { t: 'thinking_delta'; text: string }
  | { t: 'block'; block: ChatBlock }
  | {
      t: 'permission_request'
      requestId: string
      tool: string
      input: unknown
    }
  | { t: 'turn_end'; stopReason?: string; usage?: ChatUsage }
  | { t: 'error'; message: string }
  | { t: 'done' }

export interface ChatUsage {
  inputTokens?: number
  outputTokens?: number
  totalCostUsd?: number
}

/** A live event addressed to a specific live session, as sent over IPC. */
export interface ChatStreamEnvelope {
  liveId: string
  event: ChatStreamEvent
}

export type ChatPermissionDecision = 'allow_once' | 'allow_always' | 'deny'
