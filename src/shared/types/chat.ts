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
