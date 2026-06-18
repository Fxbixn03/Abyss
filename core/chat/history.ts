/**
 * Thin history facade over the runtime registry. Keeps the IPC layer agnostic
 * of which agent backs a session.
 */

import type { OsEnv } from '@/shared/types/agent'
import type {
  ChatListOptions,
  ChatSessionPage,
  ChatTranscript,
} from '@/shared/types/chat'
import { getChatRuntime, hasChatRuntime } from './registry'
import { ConfigWriteError } from '../config-error'

export function listChatSessions(
  env: OsEnv,
  agentId: string,
  opts?: ChatListOptions,
): Promise<ChatSessionPage> {
  if (!hasChatRuntime(agentId)) return Promise.resolve({ sessions: [], total: 0 })
  return getChatRuntime(agentId).listSessions(env, opts)
}

export function readChatSession(
  env: OsEnv,
  agentId: string,
  sessionId: string,
): Promise<ChatTranscript> {
  return getChatRuntime(agentId).readSession(env, sessionId)
}

export function deleteChatSession(
  env: OsEnv,
  agentId: string,
  sessionId: string,
): Promise<void> {
  return getChatRuntime(agentId).deleteSession(env, sessionId)
}

/**
 * Rename a chat session by updating its title.
 *
 * Dispatches to the runtime's optional `renameSession` method when present.
 * Runtimes that support renaming implement `renameSession` directly, so this
 * facade never needs to know their agent-specific format. Runtimes that do not
 * support renaming leave the method unimplemented and this function throws a
 * `ConfigWriteError` with a 'not supported' message that the caller can catch
 * silently.
 */
export async function renameChatSession(
  env: OsEnv,
  agentId: string,
  sessionId: string,
  title: string,
): Promise<void> {
  const runtime = hasChatRuntime(agentId) ? getChatRuntime(agentId) : null
  if (runtime?.renameSession) {
    return runtime.renameSession(env, sessionId, title)
  }
  throw new ConfigWriteError(
    sessionId,
    new Error(`Rename is not supported for agent: ${agentId}`),
  )
}
