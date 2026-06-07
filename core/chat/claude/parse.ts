/**
 * Parse Claude Code's JSONL transcripts into the normalized chat model. Each
 * line is one event; we care about `user` / `assistant` message lines and
 * `summary` lines (used for nicer titles).
 */

import path from 'node:path'
import { promises as fs } from 'node:fs'
import type { OsEnv } from '@/shared/types/agent'
import type {
  ChatListOptions,
  ChatMessage,
  ChatSessionMeta,
  ChatSessionPage,
  ChatRole,
  ChatTranscript,
} from '@/shared/types/chat'
import { readJsonlLines, asString, asRecord } from '../jsonl'
import {
  blocksFromAnthropicContent,
  firstTextSnippet,
  projectLabelFromCwd,
} from '../normalize'
import { isUnderDir, paginateByMtime } from '../paginate'
import {
  decodeProjectDir,
  findClaudeSessionFile,
  listClaudeSessionFiles,
} from './paths'

const MESSAGE_TYPES = new Set(['user', 'assistant'])

function sessionIdFromFile(filePath: string): string {
  return path.basename(filePath).replace(/\.jsonl$/i, '')
}

/** Cheap-ish single pass over one file to build its list metadata. */
export async function readSessionMeta(
  filePath: string,
  projectDir: string,
): Promise<ChatSessionMeta | null> {
  const stat = await fs.stat(filePath)
  let title = ''
  let summary = ''
  let cwd = ''
  let gitBranch: string | undefined
  let messageCount = 0
  let startedAt: string | undefined
  let updatedAt: string | undefined
  let inputTokens = 0
  let outputTokens = 0

  for await (const line of readJsonlLines(filePath)) {
    const type = asString(line.type)
    const ts = asString(line.timestamp)
    if (ts) {
      if (!startedAt) startedAt = ts
      updatedAt = ts
    }
    if (!cwd) cwd = asString(line.cwd) ?? ''
    if (!gitBranch) gitBranch = asString(line.gitBranch) || undefined

    if (type === 'summary') {
      summary = asString(line.summary) ?? summary
      continue
    }
    if (!type || !MESSAGE_TYPES.has(type)) continue
    if (line.isMeta === true) continue

    const message = asRecord(line.message)
    if (!message) continue
    messageCount += 1
    if (!title && asString(message.role) === 'user') {
      title = firstTextSnippet(message.content)
    }
    const usage = asRecord(message.usage)
    if (usage) {
      if (typeof usage.input_tokens === 'number')
        inputTokens += usage.input_tokens
      if (typeof usage.output_tokens === 'number') {
        outputTokens += usage.output_tokens
      }
    }
  }

  if (messageCount === 0) return null
  if (!cwd) cwd = decodeProjectDir(projectDir)

  return {
    id: sessionIdFromFile(filePath),
    agentId: 'claude',
    title: summary || title || 'Untitled session',
    cwd,
    projectLabel: projectLabelFromCwd(cwd),
    gitBranch,
    messageCount,
    startedAt,
    updatedAt: updatedAt ?? stat.mtime.toISOString(),
    sizeBytes: stat.size,
    inputTokens: inputTokens || undefined,
    outputTokens: outputTokens || undefined,
    filePath,
  }
}

export async function listClaudeSessions(
  env: OsEnv,
  opts?: ChatListOptions,
): Promise<ChatSessionPage> {
  let files = await listClaudeSessionFiles(env)
  // The project folder name encodes the cwd, so we can scope by project without
  // parsing any file content.
  if (opts?.cwd) {
    const project = opts.cwd
    files = files.filter((f) => isUnderDir(decodeProjectDir(f.projectDir), project))
  }
  return paginateByMtime(
    files.map((f) => ({ filePath: f.filePath, ref: f })),
    opts,
    (f) => readSessionMeta(f.filePath, f.projectDir),
  )
}

export async function readClaudeSession(
  env: OsEnv,
  sessionId: string,
): Promise<ChatTranscript> {
  const found = await findClaudeSessionFile(env, sessionId)
  if (!found) throw new Error(`Claude session not found: ${sessionId}`)

  const messages: ChatMessage[] = []
  let cwd = ''
  let gitBranch: string | undefined
  let startedAt: string | undefined
  let updatedAt: string | undefined
  let title = ''
  let summary = ''

  for await (const line of readJsonlLines(found.filePath)) {
    const type = asString(line.type)
    const ts = asString(line.timestamp)
    if (ts) {
      if (!startedAt) startedAt = ts
      updatedAt = ts
    }
    if (!cwd) cwd = asString(line.cwd) ?? ''
    if (!gitBranch) gitBranch = asString(line.gitBranch) || undefined

    if (type === 'summary') {
      summary = asString(line.summary) ?? summary
      continue
    }
    if (!type || !MESSAGE_TYPES.has(type)) continue
    if (line.isMeta === true) continue

    const message = asRecord(line.message)
    if (!message) continue
    const blocks = blocksFromAnthropicContent(message.content)
    if (blocks.length === 0) continue

    const role = (asString(message.role) ?? type) as ChatRole
    if (!title && role === 'user') title = firstTextSnippet(message.content)
    messages.push({
      id: asString(line.uuid) ?? `${messages.length}`,
      role,
      blocks,
      timestamp: ts,
      model: asString(message.model),
      isSidechain: line.isSidechain === true,
    })
  }

  if (!cwd) cwd = decodeProjectDir(found.projectDir)
  const stat = await fs.stat(found.filePath)

  return {
    id: sessionId,
    agentId: 'claude',
    title: summary || title || 'Untitled session',
    cwd,
    projectLabel: projectLabelFromCwd(cwd),
    gitBranch,
    messageCount: messages.length,
    startedAt,
    updatedAt: updatedAt ?? stat.mtime.toISOString(),
    sizeBytes: stat.size,
    filePath: found.filePath,
    messages,
  }
}

export async function deleteClaudeSession(
  env: OsEnv,
  sessionId: string,
): Promise<void> {
  const found = await findClaudeSessionFile(env, sessionId)
  if (!found) return
  await fs.rm(found.filePath, { force: true })
}
