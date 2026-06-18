/**
 * Parse Goose (Block) JSONL sessions into the normalized chat model.
 *
 * Goose stores each conversation in
 * `~/.config/goose/sessions/<session-id>.jsonl` (Linux/macOS) or
 * `%APPDATA%\goose\sessions\<session-id>.jsonl` (Windows) where every line is a
 * JSON event. The exact schema can vary by Goose version, so this parser is
 * intentionally tolerant — it extracts `role` + content from the most common
 * shapes and skips lines it does not recognise.
 *
 * Observed Goose JSONL event shapes:
 *   - `{ "role": "user" | "assistant", "content": <string | block[]> }`
 *   - `{ "type": "user" | "assistant", "content": <string | block[]> }`
 *   - `{ "message": { "role": "…", "content": "…" } }`
 *   - Anthropic-compatible content blocks (text, tool_use, tool_result, etc.)
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
import { blocksFromAnthropicContent, projectLabelFromCwd } from '../normalize'
import { paginateByMtime } from '../paginate'
import {
  gooseSessionId,
  findGooseSessionFile,
  listGooseSessionFiles,
} from './paths'
import type { ChatSessionFileRef } from '../runtime'
import { ConfigWriteError, ConfigNotFoundError, ConfigDiskError } from '../../config-error'
import { isPermissionError, isDiskError } from '../../os-errors'

/**
 * Attempt to extract a role + content pair from a Goose JSONL event line.
 */
function extractMessage(
  line: Record<string, unknown>,
): { role: ChatRole; blocks: ChatBlock[] } | null {
  // Shape 1: top-level role + content (Anthropic-like)
  const topRole = asString(line.role)
  if (topRole === 'user' || topRole === 'assistant' || topRole === 'system') {
    const role: ChatRole =
      topRole === 'assistant' ? 'assistant' : topRole === 'system' ? 'system' : 'user'
    const blocks = extractBlocks(line.content)
    return blocks.length > 0 ? { role, blocks } : null
  }

  // Shape 2: top-level type field acting as role
  const topType = asString(line.type)
  if (topType === 'user' || topType === 'assistant') {
    const role: ChatRole = topType === 'assistant' ? 'assistant' : 'user'
    const blocks = extractBlocks(line.content ?? line.parts)
    return blocks.length > 0 ? { role, blocks } : null
  }

  // Shape 3: wrapped message object
  const msg = asRecord(line.message)
  if (msg) {
    const msgRole = asString(msg.role)
    const role: ChatRole =
      msgRole === 'assistant'
        ? 'assistant'
        : msgRole === 'system'
          ? 'system'
          : 'user'
    const blocks = extractBlocks(msg.content ?? msg.parts)
    return blocks.length > 0 ? { role, blocks } : null
  }

  return null
}

/**
 * Extract ChatBlock[] from Goose content / parts shapes. Tries Anthropic-style
 * blocks first (since Goose uses Anthropic-compatible content), then plain
 * strings.
 */
function extractBlocks(value: unknown): ChatBlock[] {
  if (!value) return []

  // Plain string content
  if (typeof value === 'string') {
    return value.trim() === '' ? [] : [{ kind: 'text', text: value }]
  }

  if (Array.isArray(value)) {
    // Try as Anthropic-style blocks (text, tool_use, tool_result, image, thinking)
    const anthropic = blocksFromAnthropicContent(value)
    if (anthropic.length > 0) return anthropic

    // Fall back to parts format: [{ text: "…" }, …]
    const blocks: ChatBlock[] = []
    for (const raw of value) {
      const part = asRecord(raw)
      if (!part) {
        if (typeof raw === 'string' && raw.trim() !== '') {
          blocks.push({ kind: 'text', text: raw })
        }
        continue
      }
      const text = asString(part.text)
      if (text && text.trim() !== '') {
        blocks.push({ kind: 'text', text })
      }
    }
    return blocks
  }

  return []
}

/** Read session-level metadata for the list view (one fast pass over the file). */
export async function readGooseMeta(
  ref: ChatSessionFileRef,
): Promise<ChatSessionMeta | null> {
  const { filePath } = ref
  const id = gooseSessionId(filePath)
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
    agentId: 'goose',
    title: title || 'Goose session',
    cwd,
    projectLabel: cwd ? projectLabelFromCwd(cwd) : 'Goose',
    messageCount,
    startedAt,
    updatedAt: updatedAt ?? stat.mtime.toISOString(),
    sizeBytes: stat.size,
    filePath,
  }
}

export async function listGooseSessions(
  env: OsEnv,
  opts?: ChatListOptions,
): Promise<ChatSessionPage> {
  const files = await listGooseSessionFiles(env)
  return paginateByMtime(
    files.map((f) => ({ filePath: f, ref: { filePath: f } })),
    opts,
    (ref) => readGooseMeta(ref),
  )
}

export async function readGooseSession(
  env: OsEnv,
  sessionId: string,
): Promise<ChatTranscript> {
  const filePath = await findGooseSessionFile(env, sessionId)
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
    agentId: 'goose',
    title: title || 'Goose session',
    cwd,
    projectLabel: cwd ? projectLabelFromCwd(cwd) : 'Goose',
    messageCount: messages.length,
    startedAt,
    updatedAt: updatedAt ?? stat.mtime.toISOString(),
    sizeBytes: stat.size,
    filePath,
    messages,
  }
}

/**
 * Delete a Goose session by removing its JSONL file. Wraps OS permission errors
 * in a typed `ConfigWriteError` (mirrors the F150 pattern used by other
 * runtimes).
 */
export async function deleteGooseSession(
  env: OsEnv,
  sessionId: string,
): Promise<void> {
  const filePath = await findGooseSessionFile(env, sessionId)
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
