/**
 * Parse Amazon Q Developer CLI conversation JSON files into the normalized
 * chat model.
 *
 * Amazon Q Developer CLI stores each conversation at:
 *   `~/.aws/amazonq/conversations/<uuid>.json`
 *
 * The file contains a top-level object. Common shapes observed:
 *   - `{ "messages": [{ "role": "user"|"assistant", "content": <string|block[]> }, …] }`
 *   - Each message entry uses the Anthropic-compatible content format.
 *
 * The parser is intentionally tolerant — it extracts `role` + content from the
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
import { asRecord, asString } from '../jsonl'
import { blocksFromAnthropicContent, projectLabelFromCwd } from '../normalize'
import { paginateByMtime } from '../paginate'
import {
  amazonqSessionId,
  findAmazonqSessionFile,
  listAmazonqSessionFiles,
} from './paths'
import type { ChatSessionFileRef } from '../runtime'
import { ConfigWriteError, ConfigNotFoundError } from '../../config-error'

/** Top-level shape of an Amazon Q conversation JSON file. */
interface AmazonqConversationFile {
  messages?: unknown[]
  [key: string]: unknown
}

/**
 * Parse the raw JSON content of an Amazon Q session file. Returns the parsed
 * object or null if it does not look like a valid conversation file.
 */
async function readConversationFile(
  filePath: string,
): Promise<AmazonqConversationFile | null> {
  let raw: string
  try {
    raw = await fs.readFile(filePath, 'utf8')
  } catch {
    return null
  }
  if (raw.trim() === '') return null
  try {
    const parsed: unknown = JSON.parse(raw)
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as AmazonqConversationFile
    }
  } catch {
    // malformed JSON — skip this file
  }
  return null
}

/** Read session-level metadata for the list view (one file parse). */
export async function readAmazonqMeta(
  ref: ChatSessionFileRef,
): Promise<ChatSessionMeta | null> {
  const { filePath } = ref
  const id = amazonqSessionId(filePath)

  let stat: Awaited<ReturnType<typeof fs.stat>>
  try {
    stat = await fs.stat(filePath)
  } catch {
    return null
  }

  const data = await readConversationFile(filePath)
  if (!data) return null

  const rawMessages = Array.isArray(data.messages) ? data.messages : []
  let title = ''
  let messageCount = 0
  let startedAt: string | undefined
  let updatedAt: string | undefined

  for (const raw of rawMessages) {
    const entry = asRecord(raw)
    if (!entry) continue

    // Collect timestamp when present
    const ts =
      asString(entry.timestamp) ??
      asString(entry.ts) ??
      asString(entry.createdAt)
    if (ts) {
      if (!startedAt) startedAt = ts
      updatedAt = ts
    }

    const roleStr = asString(entry.role)
    if (roleStr !== 'user' && roleStr !== 'assistant' && roleStr !== 'system') {
      continue
    }

    const blocks = blocksFromAnthropicContent(entry.content)
    if (blocks.length === 0) continue

    messageCount += 1
    if (!title && roleStr === 'user') {
      const textBlock = blocks.find((b) => b.kind === 'text')
      if (textBlock && textBlock.kind === 'text') {
        title = textBlock.text.replace(/\s+/g, ' ').slice(0, 80)
      }
    }
  }

  if (messageCount === 0) return null

  return {
    id,
    agentId: 'amazonq',
    title: title || 'Amazon Q conversation',
    cwd: '',
    projectLabel: 'Amazon Q',
    messageCount,
    startedAt,
    updatedAt: updatedAt ?? stat.mtime.toISOString(),
    sizeBytes: stat.size,
    filePath,
  }
}

export async function listAmazonqSessions(
  env: OsEnv,
  opts?: ChatListOptions,
): Promise<ChatSessionPage> {
  const files = await listAmazonqSessionFiles(env)
  return paginateByMtime(
    files.map((f) => ({ filePath: f, ref: { filePath: f } })),
    opts,
    (ref) => readAmazonqMeta(ref),
  )
}

export async function readAmazonqSession(
  env: OsEnv,
  sessionId: string,
): Promise<ChatTranscript> {
  const filePath = await findAmazonqSessionFile(env, sessionId)
  if (!filePath) throw new ConfigNotFoundError(sessionId)

  const data = await readConversationFile(filePath)
  if (!data) throw new ConfigNotFoundError(sessionId)

  const rawMessages = Array.isArray(data.messages) ? data.messages : []
  const messages: ChatMessage[] = []
  let title = ''
  let startedAt: string | undefined
  let updatedAt: string | undefined

  for (const raw of rawMessages) {
    const entry = asRecord(raw)
    if (!entry) continue

    const ts =
      asString(entry.timestamp) ??
      asString(entry.ts) ??
      asString(entry.createdAt)
    if (ts) {
      if (!startedAt) startedAt = ts
      updatedAt = ts
    }

    const roleStr = asString(entry.role)
    if (roleStr !== 'user' && roleStr !== 'assistant' && roleStr !== 'system') {
      continue
    }

    const role: ChatRole = roleStr
    const blocks = blocksFromAnthropicContent(entry.content)
    if (blocks.length === 0) continue

    if (!title && role === 'user') {
      const textBlock = blocks.find((b) => b.kind === 'text')
      if (textBlock && textBlock.kind === 'text') {
        title = textBlock.text.replace(/\s+/g, ' ').slice(0, 80)
      }
    }

    messages.push({
      id:
        asString(entry.id) ??
        asString(entry.messageId) ??
        `${messages.length}`,
      role,
      blocks,
      timestamp: ts,
    })
  }

  const stat = await fs.stat(filePath)

  return {
    id: sessionId,
    agentId: 'amazonq',
    title: title || 'Amazon Q conversation',
    cwd: '',
    projectLabel: projectLabelFromCwd(''),
    messageCount: messages.length,
    startedAt,
    updatedAt: updatedAt ?? stat.mtime.toISOString(),
    sizeBytes: stat.size,
    filePath,
    messages,
  }
}

/**
 * Delete an Amazon Q session by removing its JSON file.
 */
export async function deleteAmazonqSession(
  env: OsEnv,
  sessionId: string,
): Promise<void> {
  const filePath = await findAmazonqSessionFile(env, sessionId)
  if (!filePath) return
  try {
    await fs.rm(filePath, { force: true })
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code
    if (code === 'EACCES' || code === 'EPERM') {
      throw new ConfigWriteError(filePath, err)
    }
    throw err
  }
}

/** Collect session file refs for the usage aggregator. */
export async function listAmazonqSessionFileRefs(
  env: OsEnv,
): Promise<ChatSessionFileRef[]> {
  const files = await listAmazonqSessionFiles(env)
  return files.map((filePath) => ({ filePath }))
}
