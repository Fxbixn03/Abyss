/**
 * Parse GitHub Copilot CLI conversation JSON files into the normalized chat
 * model.
 *
 * Copilot CLI stores each conversation at:
 *   `~/.copilot/conversations/<session-id>.json`
 *
 * Each file is a JSON object with a `messages` array using the standard OpenAI
 * role/content shape:
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
import { blocksFromAnthropicContent, projectLabelFromCwd } from '../normalize'
import { paginateByMtime } from '../paginate'
import {
  copilotSessionId,
  findCopilotSessionFile,
  listCopilotSessionFiles,
} from './paths'
import type { ChatSessionFileRef } from '../runtime'
import { ConfigWriteError, ConfigNotFoundError } from '../../config-error'

/** Top-level shape of a Copilot CLI conversation JSON file. */
interface CopilotSessionFile {
  title?: unknown
  messages?: unknown[]
  [key: string]: unknown
}

/**
 * Parse the raw JSON content of a Copilot session file. Returns the parsed
 * object or null if it does not look like a valid session file.
 */
async function readSessionFile(
  filePath: string,
): Promise<CopilotSessionFile | null> {
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
      return parsed as CopilotSessionFile
    }
  } catch {
    // malformed JSON — skip this file
  }
  return null
}

/** Read session-level metadata for the list view (one file parse). */
export async function readCopilotMeta(
  ref: ChatSessionFileRef,
): Promise<ChatSessionMeta | null> {
  const { filePath } = ref
  const id = copilotSessionId(filePath)

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

  const title =
    asString(data.title) || derivedTitle || 'Copilot conversation'

  return {
    id,
    agentId: 'copilot',
    title,
    cwd: '',
    projectLabel: 'Copilot',
    messageCount,
    startedAt,
    updatedAt: updatedAt ?? stat.mtime.toISOString(),
    sizeBytes: stat.size,
    filePath,
  }
}

export async function listCopilotSessions(
  env: OsEnv,
  opts?: ChatListOptions,
): Promise<ChatSessionPage> {
  const files = await listCopilotSessionFiles(env)
  return paginateByMtime(
    files.map((f) => ({ filePath: f, ref: { filePath: f } })),
    opts,
    (ref) => readCopilotMeta(ref),
  )
}

export async function readCopilotSession(
  env: OsEnv,
  sessionId: string,
): Promise<ChatTranscript> {
  const filePath = await findCopilotSessionFile(env, sessionId)
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
  const title = asString(data.title) || derivedTitle || 'Copilot conversation'

  return {
    id: sessionId,
    agentId: 'copilot',
    title,
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
 * Delete a Copilot session by removing its JSON file.
 * Wraps EACCES/EPERM in ConfigWriteError so the renderer can surface a
 * permission-denied toast.
 */
export async function deleteCopilotSession(
  env: OsEnv,
  sessionId: string,
): Promise<void> {
  const filePath = await findCopilotSessionFile(env, sessionId)
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
export async function listCopilotSessionFileRefs(
  env: OsEnv,
): Promise<ChatSessionFileRef[]> {
  const files = await listCopilotSessionFiles(env)
  return files.map((filePath) => ({ filePath }))
}
