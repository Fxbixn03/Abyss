/**
 * Parse Cursor JSONL conversation logs into the normalized chat model.
 *
 * Cursor (a VS Code fork) stores each conversation in
 * `~/.cursor/logs/conversations/<session-id>.jsonl` where every line is a JSON
 * event. The exact schema varies by Cursor version, so this parser is
 * intentionally tolerant — it extracts `role` + content from the most common
 * shapes and skips lines it does not recognise.
 *
 * Common Cursor JSONL event shapes observed in the wild:
 *   - `{ "role": "user" | "assistant", "content": <string | block[]> }`
 *   - `{ "type": "user" | "assistant", "message": { "role": "…", "content": "…" } }`
 *   - `{ "human": "…" }` / `{ "assistant": "…" }` (older format)
 *   - Anthropic-compatible: `{ "role": "user", "content": [{ "type": "text", "text": "…" }] }`
 */

import { promises as fs } from 'node:fs'
import type { OsEnv } from '@/shared/types/agent'
import type {
  ChatBlock,
  ChatListOptions,
  ChatMessage,
  ChatRole,
  ChatSessionMeta,
  ChatSessionPage,
  ChatTranscript,
} from '@/shared/types/chat'
import { readJsonlLines, asString, asRecord } from '../jsonl'
import { ConfigWriteError, ConfigNotFoundError } from '../../config-error'
import { blocksFromAnthropicContent, projectLabelFromCwd } from '../normalize'
import { paginateByMtime } from '../paginate'
import {
  cursorSessionId,
  findCursorSessionFile,
  listCursorSessionFiles,
} from './paths'
import type { ChatSessionFileRef } from '../runtime'

/**
 * Attempt to extract a role + content pair from a Cursor JSONL event line.
 * Returns null for non-message lines (system metadata, tool calls without
 * content, etc.).
 */
function extractMessage(
  line: Record<string, unknown>,
): { role: ChatRole; blocks: ChatBlock[] } | null {
  // Shape 1: top-level role + content (VS Code / Cursor native format)
  const topRole = asString(line.role)
  if (topRole === 'user' || topRole === 'assistant') {
    const blocks = extractBlocks(line.content)
    return blocks.length > 0 ? { role: topRole, blocks } : null
  }
  if (topRole === 'system') {
    const blocks = extractBlocks(line.content)
    return blocks.length > 0 ? { role: 'system', blocks } : null
  }

  // Shape 2: type wrapper with nested message object
  const topType = asString(line.type)
  if (topType === 'user' || topType === 'human') {
    const msg = asRecord(line.message)
    const content = msg ? (msg.content ?? msg.text) : (line.content ?? line.text)
    const blocks = extractBlocks(content)
    return blocks.length > 0 ? { role: 'user', blocks } : null
  }
  if (topType === 'assistant' || topType === 'bot') {
    const msg = asRecord(line.message)
    const content = msg
      ? (msg.content ?? msg.text)
      : (line.content ?? line.text)
    const blocks = extractBlocks(content)
    return blocks.length > 0 ? { role: 'assistant', blocks } : null
  }

  // Shape 3: older key-per-role format { "human": "...", "assistant": "..." }
  const humanText = asString(line.human)
  if (humanText && humanText.trim() !== '') {
    return { role: 'user', blocks: [{ kind: 'text', text: humanText }] }
  }
  const assistantText = asString(line.assistant)
  if (assistantText && assistantText.trim() !== '') {
    return { role: 'assistant', blocks: [{ kind: 'text', text: assistantText }] }
  }

  // Shape 4: wrapped message object at top level
  const msg = asRecord(line.message)
  if (msg) {
    const msgRole = asString(msg.role)
    const role: ChatRole =
      msgRole === 'assistant'
        ? 'assistant'
        : msgRole === 'system'
          ? 'system'
          : 'user'
    const blocks = extractBlocks(msg.content ?? msg.text)
    return blocks.length > 0 ? { role, blocks } : null
  }

  return null
}

/** Extract ChatBlock[] from a Cursor content value. */
function extractBlocks(value: unknown): ChatBlock[] {
  if (!value) return []

  // Plain string
  if (typeof value === 'string') {
    return value.trim() === '' ? [] : [{ kind: 'text', text: value }]
  }

  if (Array.isArray(value)) {
    // Try Anthropic-style block array first
    const anthropic = blocksFromAnthropicContent(value)
    if (anthropic.length > 0) return anthropic

    // Fall back to flat string array
    const parts: ChatBlock[] = []
    for (const item of value) {
      if (typeof item === 'string' && item.trim() !== '') {
        parts.push({ kind: 'text', text: item })
      } else {
        const rec = asRecord(item)
        if (rec) {
          const text = asString(rec.text) ?? asString(rec.content)
          if (text && text.trim() !== '') {
            parts.push({ kind: 'text', text })
          }
        }
      }
    }
    return parts
  }

  return []
}

/** Read session-level metadata for the list view (one fast pass over the file). */
export async function readCursorSessionMeta(
  ref: ChatSessionFileRef,
): Promise<ChatSessionMeta | null> {
  const { filePath } = ref
  const id = cursorSessionId(filePath)
  const stat = await fs.stat(filePath)

  let title = ''
  let cwd = ''
  let messageCount = 0
  let startedAt: string | undefined
  let updatedAt: string | undefined

  for await (const line of readJsonlLines(filePath)) {
    const ts =
      asString(line.timestamp) ??
      asString(line.ts) ??
      asString(asRecord(line.metadata)?.timestamp)
    if (ts) {
      if (!startedAt) startedAt = ts
      updatedAt = ts
    }
    if (!cwd) {
      cwd =
        asString(line.cwd) ??
        asString(asRecord(line.metadata)?.cwd) ??
        asString(asRecord(line.context)?.workingDirectory) ??
        ''
    }
    const extracted = extractMessage(line)
    if (!extracted) continue
    messageCount += 1
    if (!title && extracted.role === 'user') {
      const textBlock = extracted.blocks.find((b) => b.kind === 'text')
      if (textBlock && textBlock.kind === 'text') {
        title = textBlock.text.replace(/\s+/g, ' ').slice(0, 80)
      }
    }
  }

  if (messageCount === 0) return null
  return {
    id,
    agentId: 'cursor',
    title: title || 'Cursor session',
    cwd,
    projectLabel: cwd ? projectLabelFromCwd(cwd) : 'Cursor',
    messageCount,
    startedAt,
    updatedAt: updatedAt ?? stat.mtime.toISOString(),
    sizeBytes: stat.size,
    filePath,
  }
}

/** Alias used by the usage source contract. */
export { readCursorSessionMeta as readCursorMeta }

export async function listCursorSessions(
  env: OsEnv,
  opts?: ChatListOptions,
): Promise<ChatSessionPage> {
  const files = await listCursorSessionFiles(env)
  return paginateByMtime(
    files.map((f) => ({ filePath: f, ref: { filePath: f } })),
    opts,
    (ref) => readCursorSessionMeta(ref),
  )
}

export async function readCursorSession(
  env: OsEnv,
  sessionId: string,
): Promise<ChatTranscript> {
  const filePath = await findCursorSessionFile(env, sessionId)
  if (!filePath) throw new ConfigNotFoundError(sessionId)

  const messages: ChatMessage[] = []
  let cwd = ''
  let startedAt: string | undefined
  let updatedAt: string | undefined
  let title = ''

  for await (const line of readJsonlLines(filePath)) {
    const ts =
      asString(line.timestamp) ??
      asString(line.ts) ??
      asString(asRecord(line.metadata)?.timestamp)
    if (ts) {
      if (!startedAt) startedAt = ts
      updatedAt = ts
    }
    if (!cwd) {
      cwd =
        asString(line.cwd) ??
        asString(asRecord(line.metadata)?.cwd) ??
        asString(asRecord(line.context)?.workingDirectory) ??
        ''
    }

    const extracted = extractMessage(line)
    if (!extracted) continue

    if (!title && extracted.role === 'user') {
      const textBlock = extracted.blocks.find((b) => b.kind === 'text')
      if (textBlock && textBlock.kind === 'text') {
        title = textBlock.text.replace(/\s+/g, ' ').slice(0, 80)
      }
    }

    messages.push({
      id: asString(line.id) ?? asString(line.uuid) ?? `${messages.length}`,
      role: extracted.role,
      blocks: extracted.blocks,
      timestamp: ts,
    })
  }

  const stat = await fs.stat(filePath)
  return {
    id: sessionId,
    agentId: 'cursor',
    title: title || 'Cursor session',
    cwd,
    projectLabel: cwd ? projectLabelFromCwd(cwd) : 'Cursor',
    messageCount: messages.length,
    startedAt,
    updatedAt: updatedAt ?? stat.mtime.toISOString(),
    sizeBytes: stat.size,
    filePath,
    messages,
  }
}

export async function deleteCursorSession(
  env: OsEnv,
  sessionId: string,
): Promise<void> {
  const filePath = await findCursorSessionFile(env, sessionId)
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
