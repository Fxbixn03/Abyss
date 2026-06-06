/**
 * The open ChatRuntime standard. Every agent that wants to appear in the Chats
 * feature implements this one interface; the registry is the only place that
 * knows which runtimes exist. Mirrors the renderer's `AgentAdapter` pattern, but
 * lives in `core/` because it does real process / disk IO.
 *
 * A new agent = one runtime file + one `register(...)` line. No UI changes.
 */

import type { OsEnv } from '@/shared/types/agent'
import type {
  ChatAvailability,
  ChatListOptions,
  ChatPermissionDecision,
  ChatSessionPage,
  ChatStartOptions,
  ChatStreamEvent,
  ChatTranscript,
} from '@/shared/types/chat'

/** A running live conversation. The session manager holds one per liveId. */
export interface LiveSession {
  send(text: string): Promise<void>
  respondPermission(
    requestId: string,
    decision: ChatPermissionDecision,
  ): Promise<void>
  interrupt(): Promise<void>
  /** Stop the underlying process and release resources. */
  dispose(): Promise<void>
}

/** Everything a runtime needs to spin up a live session. */
export interface StartContext {
  env: OsEnv
  options: ChatStartOptions
  /** Push one normalized event to the renderer for this live session. */
  emit: (event: ChatStreamEvent) => void
}

export interface ChatRuntime {
  readonly agentId: string

  // --- History (read) -------------------------------------------------------
  listSessions(env: OsEnv, opts?: ChatListOptions): Promise<ChatSessionPage>
  readSession(env: OsEnv, sessionId: string): Promise<ChatTranscript>
  deleteSession(env: OsEnv, sessionId: string): Promise<void>

  // --- Auth (subscription login lifecycle) ---------------------------------
  availability(env: OsEnv): Promise<ChatAvailability>
  /** Perform a login (native OAuth via the CLI). Returns the new availability. */
  login(env: OsEnv, apiKey?: string): Promise<ChatAvailability>
  logout(env: OsEnv): Promise<void>

  // --- Live (read/write) ----------------------------------------------------
  start(ctx: StartContext): Promise<LiveSession>
}
