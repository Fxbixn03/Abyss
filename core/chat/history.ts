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
