/**
 * Thin history facade over the runtime registry. Keeps the IPC layer agnostic
 * of which agent backs a session.
 */

import { promises as fs } from 'node:fs'
import type { OsEnv } from '@/shared/types/agent'
import type {
  ChatListOptions,
  ChatSessionPage,
  ChatTranscript,
} from '@/shared/types/chat'
import { getChatRuntime, hasChatRuntime } from './registry'
import { findClaudeSessionFile } from './claude/paths'
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
 * For Claude (JSONL-backed sessions) this appends a `{ type: 'summary',
 * summary: title }` line; the existing parser already prefers `summary` over
 * the first-message title, so the change takes effect on the next read.
 *
 * All other runtimes do not currently support renaming and throw a
 * `ConfigWriteError` with a 'not supported' message that the caller can catch
 * silently.
 */
export async function renameChatSession(
  env: OsEnv,
  agentId: string,
  sessionId: string,
  title: string,
): Promise<void> {
  if (agentId === 'claude') {
    const found = await findClaudeSessionFile(env, sessionId)
    if (!found) {
      throw new ConfigWriteError(sessionId, new Error('Session file not found'))
    }
    const line = JSON.stringify({ type: 'summary', summary: title }) + '\n'
    try {
      await fs.appendFile(found.filePath, line, 'utf8')
    } catch (err) {
      throw new ConfigWriteError(found.filePath, err)
    }
    return
  }
  throw new ConfigWriteError(
    sessionId,
    new Error(`Rename is not supported for agent: ${agentId}`),
  )
}
