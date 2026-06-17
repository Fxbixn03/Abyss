/**
 * Parse Warp terminal AI session JSONL files into the normalized chat model.
 *
 * Warp 2025+ stores each AI conversation at:
 *   `~/.warp/warp-ai/sessions/<session-id>.jsonl`
 *
 * Each line is a JSON event. Observed shapes include:
 *   - `{ "role": "user" | "assistant", "content": <string | block[]> }`
 *   - `{ "role": "user" | "assistant", "content": "…", "timestamp": "…" }`
 *
 * The parser is intentionally tolerant — it extracts role + content from the
 * most common shapes and skips lines it does not recognise.
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
import { readJsonlLines, asString, asRecord } from '../jsonl'
import { blocksFromAnthropicContent, projectLabelFromCwd } from '../normalize'
import { paginateByMtime } from '../paginate'
import { warpSessionId, findWarpSessionFile, listWarpSessionFiles } from './paths'
import type { ChatSessionFileRef } from '../runtime'
import { ConfigWriteError, ConfigNotFoundError } from '../../config-error'
import { isPermissionError } from '../../os-errors'

/** Read session-level metadata for the list view (one fast pass over the file). */
export async function readWarpMeta(
  ref: ChatSessionFileRef,
): Promise<ChatSessionMeta | null> {
  const { filePath } = ref
  const id = warpSessionId(filePath)

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

      const roleStr = asString(line.role)
      if (
        roleStr !== 'user' &&
        roleStr !== 'assistant' &&
        roleStr !== 'system'
      ) {
        continue
      }

      const blocks = blocksFromAnthropicContent(line.content)
      if (blocks.length === 0) continue

      messageCount += 1
      if (!title && roleStr === 'user') {
        const textBlock = blocks.find((b) => b.kind === 'text')
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
    agentId: 'warp',
    title: title || 'Warp AI conversation',
    cwd: '',
    projectLabel: 'Warp',
    messageCount,
    startedAt,
    updatedAt: updatedAt ?? stat.mtime.toISOString(),
    sizeBytes: stat.size,
    filePath,
  }
}

export async function listWarpSessions(
  env: OsEnv,
  opts?: ChatListOptions,
): Promise<ChatSessionPage> {
  const files = await listWarpSessionFiles(env)
  return paginateByMtime(
    files.map((f) => ({ filePath: f, ref: { filePath: f } })),
    opts,
    (ref) => readWarpMeta(ref),
  )
}

export async function readWarpSession(
  env: OsEnv,
  sessionId: string,
): Promise<ChatTranscript> {
  const filePath = await findWarpSessionFile(env, sessionId)
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

    const roleStr = asString(line.role)
    if (
      roleStr !== 'user' &&
      roleStr !== 'assistant' &&
      roleStr !== 'system'
    ) {
      continue
    }

    const role: ChatRole = roleStr
    const blocks = blocksFromAnthropicContent(line.content)
    if (blocks.length === 0) continue

    if (!title && role === 'user') {
      const textBlock = blocks.find((b) => b.kind === 'text')
      if (textBlock && textBlock.kind === 'text') {
        title = textBlock.text.replace(/\s+/g, ' ').slice(0, 80)
      }
    }

    messages.push({
      id:
        asString(line.id) ??
        asString(line.uuid) ??
        asString(line.messageId) ??
        `${messages.length}`,
      role,
      blocks,
      timestamp: ts,
    })
  }

  const stat = await fs.stat(filePath)

  return {
    id: sessionId,
    agentId: 'warp',
    title: title || 'Warp AI conversation',
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
 * Delete a Warp session by removing its JSONL file.
 * Wraps EACCES/EPERM in ConfigWriteError so the renderer can surface a
 * permission-denied toast.
 */
export async function deleteWarpSession(
  env: OsEnv,
  sessionId: string,
): Promise<void> {
  const filePath = await findWarpSessionFile(env, sessionId)
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
export async function listWarpSessionFileRefs(
  env: OsEnv,
): Promise<ChatSessionFileRef[]> {
  const files = await listWarpSessionFiles(env)
  return files.map((filePath) => ({ filePath }))
}
