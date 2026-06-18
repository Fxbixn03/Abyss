/**
 * Parse Devin CLI conversation JSON files into the normalized chat model.
 *
 * Devin CLI stores each conversation session as a JSON file at:
 *   `~/.devin/sessions/<session-id>.json`
 *
 * Each file is a JSON object with a `messages` array using standard entries:
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
import { asRecord, asString } from '../jsonl'
import { blocksFromAnthropicContent } from '../normalize'
import { paginateByMtime } from '../paginate'
import { devinSessionId, findDevinSessionFile, listDevinSessionFiles } from './paths'
import type { ChatSessionFileRef } from '../runtime'
import { ConfigWriteError, ConfigNotFoundError, ConfigDiskError } from '../../config-error'
import { isPermissionError, isDiskError } from '../../os-errors'

/** Top-level shape of a Devin session JSON file. */
interface DevinSessionFile {
  messages?: unknown[]
  [key: string]: unknown
}

/**
 * Parse the raw JSON content of a Devin session file. Returns the parsed
 * object or null if it does not look like a valid session file.
 */
async function readSessionFile(
  filePath: string,
): Promise<DevinSessionFile | null> {
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
      return parsed as DevinSessionFile
    }
  } catch {
    // malformed JSON — skip this file
  }
  return null
}

/** Read session-level metadata for the list view (one file parse). */
export async function readDevinMeta(
  ref: ChatSessionFileRef,
): Promise<ChatSessionMeta | null> {
  const { filePath } = ref
  const id = devinSessionId(filePath)

  let stat: Awaited<ReturnType<typeof fs.stat>>
  try {
    stat = await fs.stat(filePath)
  } catch {
    return null
  }

  const data = await readSessionFile(filePath)
  if (!data) return null

  const rawMessages = Array.isArray(data.messages) ? data.messages : []
  let derivedTitle = ''
  let messageCount = 0
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

    const blocks = blocksFromAnthropicContent(entry.content)
    if (blocks.length === 0) continue

    messageCount += 1
    if (!derivedTitle && roleStr === 'user') {
      const textBlock = blocks.find((b) => b.kind === 'text')
      if (textBlock && textBlock.kind === 'text') {
        derivedTitle = textBlock.text.replace(/\s+/g, ' ').slice(0, 80)
      }
    }
  }

  if (messageCount === 0) return null

  const title = derivedTitle || `Devin session (${id.slice(0, 8)})`

  return {
    id,
    agentId: 'devin',
    title,
    cwd: '',
    projectLabel: 'Devin',
    messageCount,
    startedAt,
    updatedAt: updatedAt ?? stat.mtime.toISOString(),
    sizeBytes: stat.size,
    filePath,
  }
}

export async function listDevinSessions(
  env: OsEnv,
  opts?: ChatListOptions,
): Promise<ChatSessionPage> {
  const files = await listDevinSessionFiles(env)
  return paginateByMtime(
    files.map((f) => ({ filePath: f, ref: { filePath: f } })),
    opts,
    (ref) => readDevinMeta(ref),
  )
}

export async function readDevinSession(
  env: OsEnv,
  sessionId: string,
): Promise<ChatTranscript> {
  const filePath = await findDevinSessionFile(env, sessionId)
  if (!filePath) throw new ConfigNotFoundError(sessionId)

  const data = await readSessionFile(filePath)
  if (!data) throw new ConfigNotFoundError(sessionId)

  const rawMessages = Array.isArray(data.messages) ? data.messages : []
  const messages: ChatMessage[] = []
  let derivedTitle = ''
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

    if (!derivedTitle && role === 'user') {
      const textBlock = blocks.find((b) => b.kind === 'text')
      if (textBlock && textBlock.kind === 'text') {
        derivedTitle = textBlock.text.replace(/\s+/g, ' ').slice(0, 80)
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
  const title = derivedTitle || `Devin session (${sessionId.slice(0, 8)})`

  return {
    id: sessionId,
    agentId: 'devin',
    title,
    cwd: '',
    projectLabel: 'Devin',
    messageCount: messages.length,
    startedAt,
    updatedAt: updatedAt ?? stat.mtime.toISOString(),
    sizeBytes: stat.size,
    filePath,
    messages,
  }
}

/**
 * Delete a Devin session by removing its JSON file.
 * Wraps ENOSPC/EXDEV in ConfigDiskError and EACCES/EPERM in ConfigWriteError
 * so the renderer can surface an appropriate error toast.
 */
export async function deleteDevinSession(
  env: OsEnv,
  sessionId: string,
): Promise<void> {
  const filePath = await findDevinSessionFile(env, sessionId)
  if (!filePath) return
  try {
    await fs.rm(filePath, { force: true })
  } catch (err) {
    if (isDiskError(err)) {
      throw new ConfigDiskError(filePath, err)
    }
    if (isPermissionError(err)) {
      throw new ConfigWriteError(filePath, err)
    }
    throw err
  }
}

/** Collect session file refs for the usage aggregator. */
export async function listDevinSessionFileRefs(
  env: OsEnv,
): Promise<ChatSessionFileRef[]> {
  const files = await listDevinSessionFiles(env)
  return files.map((filePath) => ({ filePath }))
}
