/**
 * Parse Codex rollout JSONL into the normalized chat model.
 *
 * NOTE: Codex's on-disk schema is less standardized than Claude's and varies by
 * version, so this parser is intentionally tolerant — it pulls role + text out
 * of the common shapes and skips anything it does not recognize. Verify against
 * a real `~/.codex` install before relying on exact fidelity.
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
import { projectLabelFromCwd } from '../normalize'
import { isUnderDir, paginateByMtime, paginateMetas } from '../paginate'
import {
  codexSessionId,
  findCodexSessionFile,
  listCodexSessionFiles,
} from './paths'

/** Pull `{ role, text }` out of a rollout line, if it is a message item. */
function extractMessage(
  line: Record<string, unknown>,
): { role: ChatRole; text: string } | null {
  // Unwrap a `payload` wrapper if present (proto-style rollout lines).
  const body = asRecord(line.payload) ?? line
  const type = asString(body.type)
  if (type && !['message', 'response_item', 'agent_message'].includes(type)) {
    return null
  }

  const roleRaw = asString(body.role)
  const role: ChatRole =
    roleRaw === 'assistant' || roleRaw === 'system' ? roleRaw : 'user'

  const content = body.content
  if (typeof content === 'string') {
    return content.trim() === '' ? null : { role, text: content }
  }
  if (Array.isArray(content)) {
    const text = content
      .map((part) => {
        const rec = asRecord(part)
        if (!rec) return typeof part === 'string' ? part : ''
        return asString(rec.text) ?? ''
      })
      .filter(Boolean)
      .join('\n')
    return text.trim() === '' ? null : { role, text }
  }
  return null
}

async function readCodexMeta(
  filePath: string,
): Promise<ChatSessionMeta | null> {
  const stat = await fs.stat(filePath)
  let title = ''
  let cwd = ''
  let messageCount = 0
  let startedAt: string | undefined
  let updatedAt: string | undefined

  for await (const line of readJsonlLines(filePath)) {
    const ts = asString(line.timestamp) ?? asString(line.ts)
    if (ts) {
      if (!startedAt) startedAt = ts
      updatedAt = ts
    }
    if (!cwd)
      cwd = asString(line.cwd) ?? asString(asRecord(line.payload)?.cwd) ?? ''
    const msg = extractMessage(line)
    if (!msg) continue
    messageCount += 1
    if (!title && msg.role === 'user') {
      title = msg.text.replace(/\s+/g, ' ').slice(0, 80)
    }
  }

  if (messageCount === 0) return null
  return {
    id: codexSessionId(filePath),
    agentId: 'codex',
    title: title || 'Codex session',
    cwd,
    projectLabel: cwd ? projectLabelFromCwd(cwd) : 'Codex',
    messageCount,
    startedAt,
    updatedAt: updatedAt ?? stat.mtime.toISOString(),
    sizeBytes: stat.size,
    filePath,
  }
}

export async function listCodexSessions(
  env: OsEnv,
  opts?: ChatListOptions,
): Promise<ChatSessionPage> {
  const files = await listCodexSessionFiles(env)

  // Codex doesn't encode the cwd in the file path, so a project filter forces a
  // full parse; otherwise we stat-sort and only parse the requested window.
  if (opts?.cwd) {
    const project = opts.cwd
    const metas = (
      await Promise.all(files.map((f) => readCodexMeta(f).catch(() => null)))
    ).filter(
      (m): m is ChatSessionMeta => m !== null && isUnderDir(m.cwd, project),
    )
    return paginateMetas(metas, opts)
  }

  return paginateByMtime(
    files.map((f) => ({ filePath: f, ref: f })),
    opts,
    (f) => readCodexMeta(f),
  )
}

export async function readCodexSession(
  env: OsEnv,
  sessionId: string,
): Promise<ChatTranscript> {
  const filePath = await findCodexSessionFile(env, sessionId)
  if (!filePath) throw new Error(`Codex session not found: ${sessionId}`)

  const messages: ChatMessage[] = []
  let cwd = ''
  let startedAt: string | undefined
  let updatedAt: string | undefined
  let title = ''

  for await (const line of readJsonlLines(filePath)) {
    const ts = asString(line.timestamp) ?? asString(line.ts)
    if (ts) {
      if (!startedAt) startedAt = ts
      updatedAt = ts
    }
    if (!cwd)
      cwd = asString(line.cwd) ?? asString(asRecord(line.payload)?.cwd) ?? ''
    const msg = extractMessage(line)
    if (!msg) continue
    if (!title && msg.role === 'user') {
      title = msg.text.replace(/\s+/g, ' ').slice(0, 80)
    }
    const blocks: ChatBlock[] = [{ kind: 'text', text: msg.text }]
    messages.push({
      id: `${messages.length}`,
      role: msg.role,
      blocks,
      timestamp: ts,
    })
  }

  const stat = await fs.stat(filePath)
  return {
    id: sessionId,
    agentId: 'codex',
    title: title || 'Codex session',
    cwd,
    projectLabel: cwd ? projectLabelFromCwd(cwd) : 'Codex',
    messageCount: messages.length,
    startedAt,
    updatedAt: updatedAt ?? stat.mtime.toISOString(),
    sizeBytes: stat.size,
    filePath,
    messages,
  }
}

export async function deleteCodexSession(
  env: OsEnv,
  sessionId: string,
): Promise<void> {
  const filePath = await findCodexSessionFile(env, sessionId)
  if (!filePath) return
  await fs.rm(filePath, { force: true })
}
