/**
 * Normalizers that turn an agent's native message content into the shared
 * {@link ChatBlock}[] model. Anthropic-style content (string | block array) is
 * the most common shape; Codex and others reuse the same primitives.
 */

import type { ChatBlock } from '@/shared/types/chat'
import { asRecord, asString } from './jsonl'

/** Render any tool_result `content` field down to a single string. */
function stringifyToolResult(content: unknown): string {
  if (typeof content === 'string') return content
  if (Array.isArray(content)) {
    return content
      .map((part) => {
        const rec = asRecord(part)
        if (rec && asString(rec.type) === 'text')
          return asString(rec.text) ?? ''
        if (rec && asString(rec.type) === 'image') return '[image]'
        return typeof part === 'string' ? part : JSON.stringify(part)
      })
      .join('\n')
  }
  if (content == null) return ''
  return JSON.stringify(content, null, 2)
}

/**
 * Anthropic-style content → ChatBlock[]. Accepts a plain string or an array of
 * `{ type, … }` blocks (text / thinking / tool_use / tool_result / image).
 */
export function blocksFromAnthropicContent(content: unknown): ChatBlock[] {
  if (typeof content === 'string') {
    return content.trim() === '' ? [] : [{ kind: 'text', text: content }]
  }
  if (!Array.isArray(content)) return []

  const blocks: ChatBlock[] = []
  for (const raw of content) {
    const part = asRecord(raw)
    if (!part) continue
    const type = asString(part.type)

    switch (type) {
      case 'text': {
        const text = asString(part.text) ?? ''
        if (text.trim() !== '') blocks.push({ kind: 'text', text })
        break
      }
      case 'thinking':
      case 'redacted_thinking': {
        const text = asString(part.thinking) ?? asString(part.text) ?? ''
        if (text.trim() !== '') blocks.push({ kind: 'thinking', text })
        break
      }
      case 'tool_use': {
        blocks.push({
          kind: 'tool_use',
          id: asString(part.id) ?? '',
          name: asString(part.name) ?? 'tool',
          input: part.input ?? {},
        })
        break
      }
      case 'tool_result': {
        blocks.push({
          kind: 'tool_result',
          toolUseId: asString(part.tool_use_id) ?? '',
          output: stringifyToolResult(part.content),
          isError: part.is_error === true,
        })
        break
      }
      case 'image': {
        blocks.push({ kind: 'image', mime: 'image/*', source: '[image]' })
        break
      }
      default:
        break
    }
  }
  return blocks
}

/** First non-empty text snippet from a content value, for session titles. */
export function firstTextSnippet(content: unknown, max = 80): string {
  const blocks = blocksFromAnthropicContent(content)
  const text = blocks.find((b) => b.kind === 'text')
  if (!text || text.kind !== 'text') return ''
  const oneLine = text.text.replace(/\s+/g, ' ').trim()
  return oneLine.length > max ? `${oneLine.slice(0, max - 1)}…` : oneLine
}

/** Decode Claude's project-folder name (slashes encoded as dashes) → cwd. */
export function projectLabelFromCwd(cwd: string): string {
  const cleaned = cwd.replace(/[/\\]+$/, '')
  const parts = cleaned.split(/[/\\]/).filter(Boolean)
  return parts[parts.length - 1] || cleaned || 'unknown'
}
