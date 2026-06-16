/**
 * Parse Gemini CLI JSONL sessions into the normalized chat model.
 *
 * Gemini CLI stores each conversation in `~/.gemini/sessions/<session-id>.jsonl`
 * where every line is a JSON event. The exact schema varies by CLI version, so
 * this parser is intentionally tolerant — it extracts `role` + content from the
 * most common shapes and skips lines it does not recognise.
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
  geminiSessionId,
  findGeminiSessionFile,
  listGeminiSessionFiles,
} from './paths'
import type { ChatSessionFileRef } from '../runtime'
import { ConfigWriteError } from '../../config-error'

/**
 * Attempt to extract a role + content pair from a Gemini JSONL event line.
 * Gemini CLI event shapes observed in the wild:
 *   - `{ "type": "user" | "model", "content": <string | block[]> }`
 *   - `{ "role": "user" | "assistant", "parts": [{ "text": "…" }] }`
 *   - `{ "message": { "role": "…", "content": "…" } }`
 *   - `{ "request": { "contents": [{ "role": "user", "parts": […] }] } }`
 *   - `{ "response": { "candidates": [{ "content": { "parts": […] } }] } }`
 */
function extractMessage(
  line: Record<string, unknown>,
): { role: ChatRole; blocks: ChatBlock[] } | null {
  // Shape 1: top-level type + content (similar to Claude/Codex)
  const topType = asString(line.type)
  if (topType === 'user' || topType === 'model') {
    const role: ChatRole = topType === 'model' ? 'assistant' : 'user'
    const blocks = extractBlocks(line.content ?? line.parts)
    return blocks.length > 0 ? { role, blocks } : null
  }

  // Shape 2: top-level role + parts (Gemini native format)
  const topRole = asString(line.role)
  if (topRole === 'user' || topRole === 'assistant') {
    const blocks = extractBlocks(line.parts ?? line.content)
    return blocks.length > 0 ? { role: topRole, blocks } : null
  }
  // Also handle 'model' role at top level
  if (topRole === 'model') {
    const blocks = extractBlocks(line.parts ?? line.content)
    return blocks.length > 0 ? { role: 'assistant', blocks } : null
  }

  // Shape 3: wrapped message object
  const msg = asRecord(line.message)
  if (msg) {
    const msgRole = asString(msg.role)
    const role: ChatRole =
      msgRole === 'assistant' || msgRole === 'model'
        ? 'assistant'
        : msgRole === 'system'
          ? 'system'
          : 'user'
    const blocks = extractBlocks(msg.content ?? msg.parts)
    return blocks.length > 0 ? { role, blocks } : null
  }

  // Shape 4: request.contents[0] (user turn in Gemini API request format)
  const request = asRecord(line.request)
  if (request) {
    const contents = Array.isArray(request.contents) ? request.contents : null
    if (contents && contents.length > 0) {
      const first = asRecord(contents[0])
      if (first) {
        const roleStr = asString(first.role)
        const role: ChatRole =
          roleStr === 'model' ? 'assistant' : roleStr === 'system' ? 'system' : 'user'
        const blocks = extractBlocks(first.parts ?? first.content)
        return blocks.length > 0 ? { role, blocks } : null
      }
    }
  }

  // Shape 5: response.candidates[0].content (assistant turn in Gemini API response)
  const response = asRecord(line.response)
  if (response) {
    const candidates = Array.isArray(response.candidates) ? response.candidates : null
    if (candidates && candidates.length > 0) {
      const first = asRecord(candidates[0])
      const content = first ? asRecord(first.content) : null
      if (content) {
        const blocks = extractBlocks(content.parts ?? content.text)
        return blocks.length > 0 ? { role: 'assistant', blocks } : null
      }
    }
  }

  return null
}

/**
 * Extract ChatBlock[] from Gemini parts / content shapes. Tries Anthropic-style
 * blocks first, then Gemini `parts` arrays, then plain strings.
 */
function extractBlocks(value: unknown): ChatBlock[] {
  if (!value) return []

  // Anthropic-style content (plain string or block array)
  if (typeof value === 'string') {
    return value.trim() === '' ? [] : [{ kind: 'text', text: value }]
  }

  if (Array.isArray(value)) {
    // Try as Anthropic blocks first
    const anthropic = blocksFromAnthropicContent(value)
    if (anthropic.length > 0) return anthropic

    // Fall back to Gemini `parts` format: [{ text: "…" }, { functionCall: … }, …]
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
        continue
      }
      const fc = asRecord(part.functionCall) ?? asRecord(part.function_call)
      if (fc) {
        blocks.push({
          kind: 'tool_use',
          id: asString(fc.id) ?? asString(part.id) ?? '',
          name: asString(fc.name) ?? 'tool',
          input: fc.args ?? fc.arguments ?? {},
        })
        continue
      }
      const fr = asRecord(part.functionResponse) ?? asRecord(part.function_response)
      if (fr) {
        const resp = fr.response ?? fr.output
        const output =
          typeof resp === 'string'
            ? resp
            : resp != null
              ? JSON.stringify(resp, null, 2)
              : ''
        blocks.push({
          kind: 'tool_result',
          toolUseId: asString(fr.name) ?? '',
          output,
          isError: false,
        })
      }
    }
    return blocks
  }

  return []
}

/** Read session-level metadata for the list view (one fast pass over the file). */
export async function readGeminiMeta(
  ref: ChatSessionFileRef,
): Promise<ChatSessionMeta | null> {
  const { filePath } = ref
  const id = geminiSessionId(filePath)
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
    agentId: 'gemini',
    title: title || 'Gemini session',
    cwd,
    projectLabel: cwd ? projectLabelFromCwd(cwd) : 'Gemini',
    messageCount,
    startedAt,
    updatedAt: updatedAt ?? stat.mtime.toISOString(),
    sizeBytes: stat.size,
    filePath,
  }
}

export async function listGeminiSessions(
  env: OsEnv,
  opts?: ChatListOptions,
): Promise<ChatSessionPage> {
  const files = await listGeminiSessionFiles(env)
  return paginateByMtime(
    files.map((f) => ({ filePath: f, ref: { filePath: f } })),
    opts,
    (ref) => readGeminiMeta(ref),
  )
}

export async function readGeminiSession(
  env: OsEnv,
  sessionId: string,
): Promise<ChatTranscript> {
  const filePath = await findGeminiSessionFile(env, sessionId)
  if (!filePath) throw new Error(`Gemini session not found: ${sessionId}`)

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
    agentId: 'gemini',
    title: title || 'Gemini session',
    cwd,
    projectLabel: cwd ? projectLabelFromCwd(cwd) : 'Gemini',
    messageCount: messages.length,
    startedAt,
    updatedAt: updatedAt ?? stat.mtime.toISOString(),
    sizeBytes: stat.size,
    filePath,
    messages,
  }
}

export async function deleteGeminiSession(
  env: OsEnv,
  sessionId: string,
): Promise<void> {
  const filePath = await findGeminiSessionFile(env, sessionId)
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
