/**
 * Parse Zed Editor AI Panel JSONL conversation files into the normalized chat model.
 *
 * Zed stores each AI Panel session as a JSONL file at:
 *   Linux/macOS: `~/.config/zed/conversations/<uuid>.jsonl`
 *   Windows:     `%APPDATA%\Zed\conversations\<uuid>.jsonl`
 *
 * Each line is a JSON object with Anthropic-compatible fields:
 *   `{ "role": "user" | "assistant" | "system", "content": <string | block[]> }`
 *
 * The parser is intentionally tolerant — it extracts role + content from the
 * most common shapes and skips entries it does not recognise.
 */

import { promises as fs } from 'node:fs'
import type { OsEnv } from '@/shared/types/agent'
import type {
  ChatListOptions,
  ChatMessage,
  ChatRole,
  ChatSessionMeta,
  ChatSessionPage,
  ChatTranscript,
} from '@/shared/types/chat'
import { asString, readJsonlLines } from '../jsonl'
import { blocksFromAnthropicContent } from '../normalize'
import { paginateByMtime } from '../paginate'
import { zedSessionId, findZedSessionFile, listZedSessionFiles } from './paths'
import type { ChatSessionFileRef } from '../runtime'
import { ConfigWriteError, ConfigNotFoundError } from '../../config-error'
import { isPermissionError } from '../../os-errors'

/** Read session-level metadata for the list view (one file parse). */
export async function readZedMeta(
  ref: ChatSessionFileRef,
): Promise<ChatSessionMeta | null> {
  const { filePath } = ref
  const id = zedSessionId(filePath)

  let stat: Awaited<ReturnType<typeof fs.stat>>
  try {
    stat = await fs.stat(filePath)
  } catch {
    return null
  }

  let derivedTitle = ''
  let messageCount = 0
  let startedAt: string | undefined
  let updatedAt: string | undefined

  try {
    for await (const entry of readJsonlLines(filePath)) {
      const ts =
        asString(entry['timestamp']) ??
        asString(entry['ts']) ??
        asString(entry['created_at'])
      if (ts) {
        if (!startedAt) startedAt = ts
        updatedAt = ts
      }

      const roleStr = asString(entry['role'])
      if (roleStr !== 'user' && roleStr !== 'assistant' && roleStr !== 'system') {
        continue
      }

      const blocks = blocksFromAnthropicContent(entry['content'])
      if (blocks.length === 0) continue

      messageCount += 1
      if (!derivedTitle && roleStr === 'user') {
        const textBlock = blocks.find((b) => b.kind === 'text')
        if (textBlock && textBlock.kind === 'text') {
          derivedTitle = textBlock.text.replace(/\s+/g, ' ').slice(0, 80)
        }
      }
    }
  } catch {
    return null
  }

  if (messageCount === 0) return null

  const title = derivedTitle || `Zed conversation (${id.slice(0, 8)})`

  return {
    id,
    agentId: 'zed',
    title,
    cwd: '',
    projectLabel: 'Zed',
    messageCount,
    startedAt,
    updatedAt: updatedAt ?? stat.mtime.toISOString(),
    sizeBytes: stat.size,
    filePath,
  }
}

export async function listZedSessions(
  env: OsEnv,
  opts?: ChatListOptions,
): Promise<ChatSessionPage> {
  const files = await listZedSessionFiles(env)
  return paginateByMtime(
    files.map((f) => ({ filePath: f, ref: { filePath: f } })),
    opts,
    (ref) => readZedMeta(ref),
  )
}

export async function readZedSession(
  env: OsEnv,
  sessionId: string,
): Promise<ChatTranscript> {
  const filePath = await findZedSessionFile(env, sessionId)
  if (!filePath) throw new ConfigNotFoundError(sessionId)

  const messages: ChatMessage[] = []
  let derivedTitle = ''
  let startedAt: string | undefined
  let updatedAt: string | undefined

  for await (const entry of readJsonlLines(filePath)) {
    const ts =
      asString(entry['timestamp']) ??
      asString(entry['ts']) ??
      asString(entry['created_at'])
    if (ts) {
      if (!startedAt) startedAt = ts
      updatedAt = ts
    }

    const roleStr = asString(entry['role'])
    if (roleStr !== 'user' && roleStr !== 'assistant' && roleStr !== 'system') {
      continue
    }

    const role: ChatRole = roleStr
    const blocks = blocksFromAnthropicContent(entry['content'])
    if (blocks.length === 0) continue

    if (!derivedTitle && role === 'user') {
      const textBlock = blocks.find((b) => b.kind === 'text')
      if (textBlock && textBlock.kind === 'text') {
        derivedTitle = textBlock.text.replace(/\s+/g, ' ').slice(0, 80)
      }
    }

    messages.push({
      id:
        asString(entry['id']) ??
        asString(entry['message_id']) ??
        `${messages.length}`,
      role,
      blocks,
      timestamp: ts,
    })
  }

  const stat = await fs.stat(filePath)
  const title = derivedTitle || `Zed conversation (${sessionId.slice(0, 8)})`

  return {
    id: sessionId,
    agentId: 'zed',
    title,
    cwd: '',
    projectLabel: 'Zed',
    messageCount: messages.length,
    startedAt,
    updatedAt: updatedAt ?? stat.mtime.toISOString(),
    sizeBytes: stat.size,
    filePath,
    messages,
  }
}

/**
 * Delete a Zed session by removing its JSONL file.
 * Wraps EACCES/EPERM in ConfigWriteError so the renderer can surface a
 * permission-denied toast.
 */
export async function deleteZedSession(
  env: OsEnv,
  sessionId: string,
): Promise<void> {
  const filePath = await findZedSessionFile(env, sessionId)
  if (!filePath) return
  try {
    await fs.rm(filePath, { force: true })
  } catch (err) {
    if (isPermissionError(err)) {
      throw new ConfigWriteError(filePath, err)
    }
    throw err
  }
}

/** Collect session file refs for the usage aggregator. */
export async function listZedSessionFileRefs(
  env: OsEnv,
): Promise<ChatSessionFileRef[]> {
  const files = await listZedSessionFiles(env)
  return files.map((filePath) => ({ filePath }))
}
