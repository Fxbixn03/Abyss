/**
 * Pure-logic tests for src/features/chats/store/stream-reducer.ts (node:test).
 * `appendDelta`, `appendBlock`, `applyUsage`, and `finalizeStreaming` are all
 * deterministic and side-effect-free — no disk access, no IPC, no React — so
 * these tests are cheap and CI-safe.
 */

import { test } from 'node:test'
import assert from 'node:assert/strict'

import {
  appendDelta,
  appendBlock,
  applyUsage,
  finalizeStreaming,
} from '@/features/chats/store/stream-reducer'
import type { ChatMessage, ChatBlock, ChatUsage } from '@/shared/types/chat'

// ── helpers ───────────────────────────────────────────────────────────────────

function makeMessage(
  id: string,
  blocks: ChatBlock[] = [],
  extra?: Partial<Pick<ChatMessage, 'streaming' | 'inputTokens' | 'outputTokens'>>,
): ChatMessage {
  return { id, role: 'assistant', blocks, ...extra }
}

// ── appendDelta — null currentId is a no-op ───────────────────────────────────

test('appendDelta: null currentId returns the same array reference', () => {
  const messages: ChatMessage[] = [makeMessage('msg-1')]
  const result = appendDelta(messages, null, 'text', 'hello')
  assert.strictEqual(result, messages)
})

// ── appendDelta — 'text' delta on matching message ────────────────────────────

test('appendDelta: text delta on matching message appends a text block', () => {
  const messages: ChatMessage[] = [makeMessage('msg-1')]
  const result = appendDelta(messages, 'msg-1', 'text', 'hello')
  assert.equal(result.length, 1)
  assert.equal(result[0].blocks.length, 1)
  assert.deepEqual(result[0].blocks[0], { kind: 'text', text: 'hello' })
})

// ── appendDelta — two consecutive text deltas coalesce ────────────────────────

test('appendDelta: two consecutive text deltas coalesce into one growing block', () => {
  const messages: ChatMessage[] = [makeMessage('msg-1')]
  const after1 = appendDelta(messages, 'msg-1', 'text', 'hello')
  const after2 = appendDelta(after1, 'msg-1', 'text', ' world')
  assert.equal(after2[0].blocks.length, 1)
  const block = after2[0].blocks[0]
  assert.equal(block.kind, 'text')
  assert.ok('text' in block)
  if ('text' in block) {
    assert.equal(block.text, 'hello world')
  }
})

// ── appendDelta — thinking delta after text block starts new block ─────────────

test('appendDelta: thinking delta after text block starts a new block', () => {
  const messages: ChatMessage[] = [makeMessage('msg-1')]
  const after1 = appendDelta(messages, 'msg-1', 'text', 'some text')
  const after2 = appendDelta(after1, 'msg-1', 'thinking', 'a thought')
  assert.equal(after2[0].blocks.length, 2)
  assert.deepEqual(after2[0].blocks[0], { kind: 'text', text: 'some text' })
  assert.deepEqual(after2[0].blocks[1], { kind: 'thinking', text: 'a thought' })
})

// ── appendDelta — text delta after thinking block starts new block ─────────────

test('appendDelta: text delta after thinking block starts a new block', () => {
  const messages: ChatMessage[] = [makeMessage('msg-1')]
  const after1 = appendDelta(messages, 'msg-1', 'thinking', 'a thought')
  const after2 = appendDelta(after1, 'msg-1', 'text', 'reply text')
  assert.equal(after2[0].blocks.length, 2)
  assert.deepEqual(after2[0].blocks[0], { kind: 'thinking', text: 'a thought' })
  assert.deepEqual(after2[0].blocks[1], { kind: 'text', text: 'reply text' })
})

// ── appendDelta — unmatched id leaves all messages unchanged ──────────────────

test('appendDelta: unmatched id leaves all messages unchanged', () => {
  const messages: ChatMessage[] = [
    makeMessage('msg-1', [{ kind: 'text', text: 'original' }]),
  ]
  const result = appendDelta(messages, 'msg-999', 'text', 'intruder')
  assert.equal(result[0].blocks.length, 1)
  assert.deepEqual(result[0].blocks[0], { kind: 'text', text: 'original' })
})

// ── appendBlock — null currentId is a no-op ───────────────────────────────────

test('appendBlock: null currentId returns the same array reference', () => {
  const messages: ChatMessage[] = [makeMessage('msg-1')]
  const block: ChatBlock = { kind: 'tool_use', id: 'tu-1', name: 'bash', input: {} }
  const result = appendBlock(messages, null, block)
  assert.strictEqual(result, messages)
})

// ── appendBlock — tool_use block appended to correct message ──────────────────

test('appendBlock: tool_use block is appended to the correct message', () => {
  const messages: ChatMessage[] = [
    makeMessage('msg-1'),
    makeMessage('msg-2'),
  ]
  const block: ChatBlock = { kind: 'tool_use', id: 'tu-1', name: 'bash', input: { command: 'ls' } }
  const result = appendBlock(messages, 'msg-2', block)
  assert.equal(result[0].blocks.length, 0)
  assert.equal(result[1].blocks.length, 1)
  assert.deepEqual(result[1].blocks[0], block)
})

// ── appendBlock — unmatched id leaves array unchanged ─────────────────────────

test('appendBlock: unmatched id leaves the array unchanged', () => {
  const messages: ChatMessage[] = [
    makeMessage('msg-1', [{ kind: 'text', text: 'hello' }]),
  ]
  const block: ChatBlock = { kind: 'tool_use', id: 'tu-1', name: 'bash', input: {} }
  const result = appendBlock(messages, 'msg-999', block)
  assert.equal(result[0].blocks.length, 1)
  assert.deepEqual(result[0].blocks[0], { kind: 'text', text: 'hello' })
})

// ── appendBlock — original array is never mutated ────────────────────────────

test('appendBlock: original messages array is never mutated', () => {
  const original: ChatMessage[] = [makeMessage('msg-1')]
  const originalBlockCount = original[0].blocks.length
  const block: ChatBlock = { kind: 'error', message: 'oops' }
  const result = appendBlock(original, 'msg-1', block)
  // The returned array must be a new reference
  assert.notStrictEqual(result, original)
  // The original message's blocks must not have been changed
  assert.equal(original[0].blocks.length, originalBlockCount)
  // The new message has the block
  assert.equal(result[0].blocks.length, 1)
  assert.deepEqual(result[0].blocks[0], block)
})

// ── applyUsage — null currentId is a no-op ───────────────────────────────────

test('applyUsage: null currentId returns the same array reference', () => {
  const messages: ChatMessage[] = [makeMessage('msg-1')]
  const usage: ChatUsage = { inputTokens: 100, outputTokens: 50 }
  const result = applyUsage(messages, null, usage)
  assert.strictEqual(result, messages)
})

// ── applyUsage — inputTokens only (outputTokens absent) ───────────────────────

test('applyUsage: partial usage with inputTokens only updates inputTokens and preserves existing outputTokens', () => {
  const messages: ChatMessage[] = [
    makeMessage('msg-1', [], { inputTokens: 10, outputTokens: 5 }),
  ]
  const usage: ChatUsage = { inputTokens: 200 }
  const result = applyUsage(messages, 'msg-1', usage)
  assert.equal(result[0].inputTokens, 200)
  // outputTokens in usage is undefined, so existing value is preserved
  assert.equal(result[0].outputTokens, 5)
})

// ── applyUsage — outputTokens only (inputTokens absent) ──────────────────────

test('applyUsage: partial usage with outputTokens only updates outputTokens and preserves existing inputTokens', () => {
  const messages: ChatMessage[] = [
    makeMessage('msg-1', [], { inputTokens: 42, outputTokens: 7 }),
  ]
  const usage: ChatUsage = { outputTokens: 99 }
  const result = applyUsage(messages, 'msg-1', usage)
  assert.equal(result[0].inputTokens, 42)
  assert.equal(result[0].outputTokens, 99)
})

// ── applyUsage — non-matching id leaves messages unchanged ────────────────────

test('applyUsage: non-matching currentId leaves other messages untouched', () => {
  const messages: ChatMessage[] = [
    makeMessage('msg-1', [], { inputTokens: 10, outputTokens: 5 }),
    makeMessage('msg-2', [], { inputTokens: 20, outputTokens: 8 }),
  ]
  const usage: ChatUsage = { inputTokens: 999, outputTokens: 999 }
  const result = applyUsage(messages, 'msg-999', usage)
  // Neither message should be modified
  assert.equal(result[0].inputTokens, 10)
  assert.equal(result[0].outputTokens, 5)
  assert.equal(result[1].inputTokens, 20)
  assert.equal(result[1].outputTokens, 8)
})

// ── applyUsage — both fields present, matching id ─────────────────────────────

test('applyUsage: both inputTokens and outputTokens updated on matching message', () => {
  const messages: ChatMessage[] = [
    makeMessage('msg-1', [], { inputTokens: 0, outputTokens: 0 }),
  ]
  const usage: ChatUsage = { inputTokens: 300, outputTokens: 150 }
  const result = applyUsage(messages, 'msg-1', usage)
  assert.equal(result[0].inputTokens, 300)
  assert.equal(result[0].outputTokens, 150)
})

// ── finalizeStreaming — null currentId is a no-op ─────────────────────────────

test('finalizeStreaming: null currentId returns the same array reference', () => {
  const messages: ChatMessage[] = [makeMessage('msg-1', [], { streaming: true })]
  const result = finalizeStreaming(messages, null)
  assert.strictEqual(result, messages)
})

// ── finalizeStreaming — sets streaming: false on matching message ──────────────

test('finalizeStreaming: sets streaming to false on the matching message', () => {
  const messages: ChatMessage[] = [
    makeMessage('msg-1', [], { streaming: true }),
  ]
  const result = finalizeStreaming(messages, 'msg-1')
  assert.equal(result[0].streaming, false)
})

// ── finalizeStreaming — leaves other messages untouched ───────────────────────

test('finalizeStreaming: leaves non-matching messages untouched', () => {
  const messages: ChatMessage[] = [
    makeMessage('msg-1', [], { streaming: true }),
    makeMessage('msg-2', [], { streaming: true }),
  ]
  const result = finalizeStreaming(messages, 'msg-1')
  assert.equal(result[0].streaming, false)
  // msg-2 was not the target — streaming state must remain true
  assert.equal(result[1].streaming, true)
})

// ── finalizeStreaming — idempotent when streaming was already false ────────────

test('finalizeStreaming: is idempotent when streaming was already false', () => {
  const messages: ChatMessage[] = [
    makeMessage('msg-1', [], { streaming: false }),
  ]
  const result = finalizeStreaming(messages, 'msg-1')
  assert.equal(result[0].streaming, false)
})
