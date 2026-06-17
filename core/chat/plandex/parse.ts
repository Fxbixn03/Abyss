/**
 * Parse Plandex CLI JSONL conversation files into the normalized chat model.
 *
 * Plandex v2 stores each plan's conversation at:
 *   `~/.plandex/plans/<plan-id>/conversation.jsonl`
 *
 * Each line is a JSON event. Common shapes observed in the wild include:
 *   - `{ "role": "user" | "assistant", "content": <string | block[]> }`
 *   - `{ "role": "user" | "assistant", "content": <string>, "timestamp": "…" }`
 *
 * The parser is intentionally tolerant — it extracts `role` + content from the
 * most common shapes and skips lines it does not recognise.
 */

import path from 'node:path'
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
  plandexSessionId,
  findPlandexSessionFile,
  listPlandexSessionFiles,
} from './paths'
import type { ChatSessionFileRef } from '../runtime'
import { ConfigWriteError, ConfigNotFoundError } from '../../config-error'

/**
 * Attempt to extract a role + content pair from a Plandex JSONL event line.
 * Plandex event shapes observed in the wild:
 *   - `{ "role": "user" | "assistant", "content": <string | block[]> }`
 *   - `{ "role": "user" | "assistant", "content": "…", "timestamp": "…" }`
 */
function extractMessage(
  line: Record<string, unknown>,
): { role: ChatRole; blocks: ChatBlock[] } | null {
  // Top-level role + content (most common Plandex shape)
  const roleStr = asString(line.role)
  if (roleStr === 'user' || roleStr === 'assistant' || roleStr === 'system') {
    const role: ChatRole = roleStr
    const blocks = extractBlocks(line.content)
    return blocks.length > 0 ? { role, blocks } : null
  }

  // Nested message object
  const msg = asRecord(line.message)
  if (msg) {
    const msgRole = asString(msg.role)
    const role: ChatRole =
      msgRole === 'assistant'
        ? 'assistant'
        : msgRole === 'system'
          ? 'system'
          : 'user'
    const blocks = extractBlocks(msg.content)
    return blocks.length > 0 ? { role, blocks } : null
  }

  return null
}

/**
 * Extract ChatBlock[] from Plandex content shapes. Tries Anthropic-style blocks
 * first (string or block array), then falls back to plain strings.
 */
function extractBlocks(value: unknown): ChatBlock[] {
  if (!value) return []

  if (typeof value === 'string') {
    return value.trim() === '' ? [] : [{ kind: 'text', text: value }]
  }

  if (Array.isArray(value)) {
    return blocksFromAnthropicContent(value)
  }

  return []
}

/** Read session-level metadata for the list view (one fast pass over the file). */
export async function readPlandexMeta(
  ref: ChatSessionFileRef,
): Promise<ChatSessionMeta | null> {
  const { filePath } = ref
  const id = plandexSessionId(filePath)
  let stat: Awaited<ReturnType<typeof fs.stat>>
  try {
    stat = await fs.stat(filePath)
  } catch {
    return null
  }

  let title = ''
  let messageCount = 0
  let startedAt: string | undefined
  let updatedAt: string | undefined

  try {
    for await (const line of readJsonlLines(filePath)) {
      const ts =
        asString(line.timestamp) ??
        asString(line.ts) ??
        asString(asRecord(line.metadata)?.timestamp)
      if (ts) {
        if (!startedAt) startedAt = ts
        updatedAt = ts
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
  } catch {
    return null
  }

  if (messageCount === 0) return null
  return {
    id,
    agentId: 'plandex',
    title: title || 'Plandex plan',
    cwd: '',
    projectLabel: 'Plandex',
    messageCount,
    startedAt,
    updatedAt: updatedAt ?? stat.mtime.toISOString(),
    sizeBytes: stat.size,
    filePath,
  }
}

export async function listPlandexSessions(
  env: OsEnv,
  opts?: ChatListOptions,
): Promise<ChatSessionPage> {
  const files = await listPlandexSessionFiles(env)
  return paginateByMtime(
    files.map((f) => ({ filePath: f, ref: { filePath: f } })),
    opts,
    (ref) => readPlandexMeta(ref),
  )
}

export async function readPlandexSession(
  env: OsEnv,
  sessionId: string,
): Promise<ChatTranscript> {
  const filePath = await findPlandexSessionFile(env, sessionId)
  if (!filePath) throw new ConfigNotFoundError(sessionId)

  const messages: ChatMessage[] = []
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
    agentId: 'plandex',
    title: title || 'Plandex plan',
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
 * Delete a Plandex session by removing the entire plan directory. Each plan
 * lives in its own directory (`~/.plandex/plans/<plan-id>/`), so removing the
 * directory cleans up the conversation and any associated files.
 */
export async function deletePlandexSession(
  env: OsEnv,
  sessionId: string,
): Promise<void> {
  const filePath = await findPlandexSessionFile(env, sessionId)
  if (!filePath) return
  const planDir = path.dirname(filePath)
  try {
    await fs.rm(planDir, { recursive: true, force: true })
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code
    if (code === 'EACCES' || code === 'EPERM') {
      throw new ConfigWriteError(planDir, err)
    }
    throw err
  }
}

/** Collect session file refs for the usage aggregator. */
export async function listPlandexSessionFileRefs(
  env: OsEnv,
): Promise<ChatSessionFileRef[]> {
  const files = await listPlandexSessionFiles(env)
  return files.map((filePath) => ({ filePath }))
}
