/**
 * Parse Cline's `api_conversation_history.json` files into the normalized chat
 * model.
 *
 * Cline stores each task's conversation at:
 *   `~/Documents/Cline/tasks/<task-id>/api_conversation_history.json`
 *
 * The file contains a JSON array of Anthropic-compatible `{ role, content }`
 * objects where `content` may be a plain string or an array of Anthropic
 * content blocks (text, tool_use, tool_result, image, etc.).
 *
 * Each task directory is its own logical session. The session id is the task
 * directory name (typically a timestamp-derived string like `1718193600000`).
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
import { blocksFromAnthropicContent, projectLabelFromCwd } from '../normalize'
import { paginateByMtime } from '../paginate'
import {
  clineSessionId,
  clineTasksDir,
  findClineSessionFile,
  listClineSessionFiles,
} from './paths'
import type { ChatSessionFileRef } from '../runtime'
import { ConfigWriteError, ConfigNotFoundError, ConfigReadError } from '../../config-error'
import { isPermissionError } from '../../os-errors'

/**
 * A single raw entry in `api_conversation_history.json`. Cline uses the
 * Anthropic messages format so each entry has `role` and `content`.
 */
interface RawClineMessage {
  role: unknown
  content: unknown
  [key: string]: unknown
}

/**
 * Normalise a raw Cline message entry into a ChatMessage. Returns null for
 * entries that carry no recognisable content.
 */
function normalizeMessage(
  raw: RawClineMessage,
  index: number,
  taskId: string,
): ChatMessage | null {
  const roleRaw = typeof raw.role === 'string' ? raw.role : ''
  const role: ChatRole =
    roleRaw === 'assistant'
      ? 'assistant'
      : roleRaw === 'system'
        ? 'system'
        : 'user'

  const blocks = blocksFromAnthropicContent(raw.content)
  if (blocks.length === 0) return null

  return {
    id: `cline-${taskId}-${index}`,
    role,
    blocks,
  }
}

/**
 * Read and parse a single `api_conversation_history.json` file. Returns null
 * when the file cannot be read or contains no recognisable messages.
 */
async function parseHistoryFile(
  filePath: string,
): Promise<{ messages: ChatMessage[]; taskId: string }> {
  const taskId = clineSessionId(filePath)
  let raw: string
  try {
    raw = await fs.readFile(filePath, 'utf-8')
  } catch (err) {
    if (isPermissionError(err)) {
      throw new ConfigReadError(filePath, err)
    }
    throw err
  }
  const parsed: unknown = JSON.parse(raw)

  if (!Array.isArray(parsed)) return { messages: [], taskId }

  const messages: ChatMessage[] = []
  let index = 0
  for (const entry of parsed) {
    if (entry == null || typeof entry !== 'object') {
      index++
      continue
    }
    const msg = normalizeMessage(
      entry as RawClineMessage,
      index,
      taskId,
    )
    if (msg) messages.push(msg)
    index++
  }

  return { messages, taskId }
}

/**
 * Derive a session title from the first user message in the conversation.
 * Falls back to 'Cline task' when no user message with text content is found.
 */
function titleFromMessages(messages: ChatMessage[]): string {
  const firstUser = messages.find((m) => m.role === 'user')
  if (!firstUser) return 'Cline task'
  const textBlock = firstUser.blocks.find((b) => b.kind === 'text')
  if (!textBlock || textBlock.kind !== 'text') return 'Cline task'
  return textBlock.text.replace(/\s+/g, ' ').slice(0, 80) || 'Cline task'
}

/** Read session-level metadata for the list view (one fast pass per file). */
export async function readClineMeta(
  ref: ChatSessionFileRef,
): Promise<ChatSessionMeta | null> {
  const { filePath } = ref
  try {
    const stat = await fs.stat(filePath)
    const { messages, taskId } = await parseHistoryFile(filePath)
    if (messages.length === 0) return null

    const title = titleFromMessages(messages)

    return {
      id: taskId,
      agentId: 'cline',
      title,
      cwd: '',
      projectLabel: 'Cline',
      messageCount: messages.length,
      updatedAt: stat.mtime.toISOString(),
      sizeBytes: stat.size,
      filePath,
    }
  } catch {
    return null
  }
}

export async function listClineSessions(
  env: OsEnv,
  opts?: ChatListOptions,
): Promise<ChatSessionPage> {
  const files = await listClineSessionFiles(env)
  return paginateByMtime(
    files.map((f) => ({ filePath: f, ref: { filePath: f } })),
    opts,
    (ref) => readClineMeta(ref),
  )
}

export async function readClineSession(
  env: OsEnv,
  sessionId: string,
): Promise<ChatTranscript> {
  const filePath = await findClineSessionFile(env, sessionId)
  if (!filePath) throw new ConfigNotFoundError(sessionId)

  const stat = await fs.stat(filePath)
  const { messages } = await parseHistoryFile(filePath)

  const title = titleFromMessages(messages)

  return {
    id: sessionId,
    agentId: 'cline',
    title,
    cwd: '',
    projectLabel: projectLabelFromCwd(''),
    messageCount: messages.length,
    updatedAt: stat.mtime.toISOString(),
    sizeBytes: stat.size,
    filePath,
    messages,
  }
}

/**
 * Delete a Cline session by removing the entire task directory. Each task lives
 * in its own directory (`~/Documents/Cline/tasks/<task-id>/`), so removing the
 * directory cleans up the conversation and any associated files.
 */
export async function deleteClineSession(
  env: OsEnv,
  sessionId: string,
): Promise<void> {
  const taskDir = `${clineTasksDir(env)}/${sessionId}`
  try {
    await fs.rm(taskDir, { recursive: true, force: true })
  } catch (err) {
    if (isPermissionError(err)) {
      throw new ConfigWriteError(taskDir, err)
    }
    throw err
  }
}

/** Collect session file refs for the usage aggregator. */
export async function listClineSessionFileRefs(
  env: OsEnv,
): Promise<ChatSessionFileRef[]> {
  const files = await listClineSessionFiles(env)
  return files.map((filePath) => ({ filePath }))
}
