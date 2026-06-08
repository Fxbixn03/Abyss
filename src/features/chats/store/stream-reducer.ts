/**
 * Pure transforms for the live chat transcript. Extracted from the Zustand
 * store so the streaming logic — merging text/thinking deltas, appending
 * finished blocks — can be unit-tested without React, the store, or the IPC
 * bridge. Each function returns a new `ChatMessage[]` (never mutates its input).
 */

import type { ChatBlock, ChatMessage } from '@/shared/types/chat'

/**
 * Merge a streaming `text`/`thinking` delta into the current message. Consecutive
 * deltas of the same kind coalesce into one growing block; a different kind (or
 * no trailing block) starts a fresh one. A null `currentId` is a no-op.
 */
export function appendDelta(
  messages: ChatMessage[],
  currentId: string | null,
  kind: 'text' | 'thinking',
  text: string,
): ChatMessage[] {
  if (!currentId) return messages
  return messages.map((m) => {
    if (m.id !== currentId) return m
    const last = m.blocks[m.blocks.length - 1]
    const merge = last && last.kind === kind
    const nextText = merge && 'text' in last ? last.text + text : text
    // Build a concrete block so the discriminated union stays narrow.
    const block: ChatBlock =
      kind === 'text'
        ? { kind: 'text', text: nextText }
        : { kind: 'thinking', text: nextText }
    const blocks = merge
      ? [...m.blocks.slice(0, -1), block]
      : [...m.blocks, block]
    return { ...m, blocks }
  })
}

/**
 * Append a finished block (tool use/result, error, …) to the current message.
 * A null `currentId`, or an id no message owns, leaves the list unchanged.
 */
export function appendBlock(
  messages: ChatMessage[],
  currentId: string | null,
  block: ChatBlock,
): ChatMessage[] {
  if (!currentId) return messages
  return messages.map((m) =>
    m.id === currentId ? { ...m, blocks: [...m.blocks, block] } : m,
  )
}
