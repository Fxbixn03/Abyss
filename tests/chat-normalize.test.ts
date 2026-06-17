/**
 * Pure-logic tests for core/chat/normalize.ts (node:test).
 * `blocksFromAnthropicContent` is deterministic and side-effect-free —
 * no disk access, no IPC, no React — so these tests are cheap and CI-safe.
 */

import { test } from 'node:test'
import assert from 'node:assert/strict'

import { blocksFromAnthropicContent } from '../core/chat/normalize'

// ── plain string input ────────────────────────────────────────────────────────

test('blocksFromAnthropicContent: plain string yields a single text block', () => {
  const result = blocksFromAnthropicContent('hello world')
  assert.equal(result.length, 1)
  assert.deepEqual(result[0], { kind: 'text', text: 'hello world' })
})

test('blocksFromAnthropicContent: empty string yields an empty array', () => {
  const result = blocksFromAnthropicContent('')
  assert.deepEqual(result, [])
})

test('blocksFromAnthropicContent: whitespace-only string yields an empty array', () => {
  const result = blocksFromAnthropicContent('   \n\t  ')
  assert.deepEqual(result, [])
})

// ── non-array, non-string input ───────────────────────────────────────────────

test('blocksFromAnthropicContent: null input yields an empty array', () => {
  const result = blocksFromAnthropicContent(null)
  assert.deepEqual(result, [])
})

test('blocksFromAnthropicContent: undefined input yields an empty array', () => {
  const result = blocksFromAnthropicContent(undefined)
  assert.deepEqual(result, [])
})

test('blocksFromAnthropicContent: number input yields an empty array', () => {
  const result = blocksFromAnthropicContent(42)
  assert.deepEqual(result, [])
})

test('blocksFromAnthropicContent: plain object (non-array) input yields an empty array', () => {
  const result = blocksFromAnthropicContent({ type: 'text', text: 'hello' })
  assert.deepEqual(result, [])
})

// ── { type: 'text' } block ────────────────────────────────────────────────────

test('blocksFromAnthropicContent: text block maps to { kind: "text" }', () => {
  const result = blocksFromAnthropicContent([
    { type: 'text', text: 'Hello from assistant' },
  ])
  assert.equal(result.length, 1)
  assert.deepEqual(result[0], { kind: 'text', text: 'Hello from assistant' })
})

test('blocksFromAnthropicContent: text block with whitespace-only text is skipped', () => {
  const result = blocksFromAnthropicContent([{ type: 'text', text: '  ' }])
  assert.deepEqual(result, [])
})

// ── { type: 'thinking' } block ────────────────────────────────────────────────

test('blocksFromAnthropicContent: thinking block maps to { kind: "thinking" }', () => {
  const result = blocksFromAnthropicContent([
    { type: 'thinking', thinking: 'Let me reason about this…' },
  ])
  assert.equal(result.length, 1)
  assert.deepEqual(result[0], {
    kind: 'thinking',
    text: 'Let me reason about this…',
  })
})

test('blocksFromAnthropicContent: redacted_thinking block maps to { kind: "thinking" }', () => {
  const result = blocksFromAnthropicContent([
    { type: 'redacted_thinking', thinking: 'hidden thought' },
  ])
  assert.equal(result.length, 1)
  const block = result[0]
  assert.equal(block.kind, 'thinking')
})

test('blocksFromAnthropicContent: thinking block with whitespace-only text is skipped', () => {
  const result = blocksFromAnthropicContent([
    { type: 'thinking', thinking: '   ' },
  ])
  assert.deepEqual(result, [])
})

// ── { type: 'tool_use' } block ────────────────────────────────────────────────

test('blocksFromAnthropicContent: tool_use block maps to { kind: "tool_use" } with correct fields', () => {
  const input = { command: 'ls -la' }
  const result = blocksFromAnthropicContent([
    { type: 'tool_use', id: 'tu_123', name: 'bash', input },
  ])
  assert.equal(result.length, 1)
  assert.deepEqual(result[0], {
    kind: 'tool_use',
    id: 'tu_123',
    name: 'bash',
    input,
  })
})

test('blocksFromAnthropicContent: tool_use block with missing id falls back to empty string', () => {
  const result = blocksFromAnthropicContent([
    { type: 'tool_use', name: 'bash', input: {} },
  ])
  assert.equal(result.length, 1)
  const block = result[0]
  assert.equal(block.kind, 'tool_use')
  if (block.kind === 'tool_use') {
    assert.equal(block.id, '')
  }
})

test('blocksFromAnthropicContent: tool_use block with missing name falls back to "tool"', () => {
  const result = blocksFromAnthropicContent([
    { type: 'tool_use', id: 'tu_abc', input: {} },
  ])
  assert.equal(result.length, 1)
  const block = result[0]
  assert.equal(block.kind, 'tool_use')
  if (block.kind === 'tool_use') {
    assert.equal(block.name, 'tool')
  }
})

// ── { type: 'tool_result' } block — string content ───────────────────────────

test('blocksFromAnthropicContent: tool_result with string content maps to { kind: "tool_result" }', () => {
  const result = blocksFromAnthropicContent([
    {
      type: 'tool_result',
      tool_use_id: 'tu_123',
      content: 'Command output here',
    },
  ])
  assert.equal(result.length, 1)
  assert.deepEqual(result[0], {
    kind: 'tool_result',
    toolUseId: 'tu_123',
    output: 'Command output here',
    isError: false,
  })
})

test('blocksFromAnthropicContent: tool_result with is_error: true maps isError to true', () => {
  const result = blocksFromAnthropicContent([
    {
      type: 'tool_result',
      tool_use_id: 'tu_456',
      content: 'Error: file not found',
      is_error: true,
    },
  ])
  assert.equal(result.length, 1)
  const block = result[0]
  assert.equal(block.kind, 'tool_result')
  if (block.kind === 'tool_result') {
    assert.equal(block.isError, true)
    assert.equal(block.output, 'Error: file not found')
  }
})

// ── { type: 'tool_result' } block — array content ────────────────────────────

test('blocksFromAnthropicContent: tool_result with array content stringifies text parts', () => {
  const result = blocksFromAnthropicContent([
    {
      type: 'tool_result',
      tool_use_id: 'tu_789',
      content: [
        { type: 'text', text: 'first line' },
        { type: 'text', text: 'second line' },
      ],
    },
  ])
  assert.equal(result.length, 1)
  const block = result[0]
  assert.equal(block.kind, 'tool_result')
  if (block.kind === 'tool_result') {
    assert.equal(block.output, 'first line\nsecond line')
  }
})

test('blocksFromAnthropicContent: tool_result with array content including image part', () => {
  const result = blocksFromAnthropicContent([
    {
      type: 'tool_result',
      tool_use_id: 'tu_img',
      content: [
        { type: 'text', text: 'screenshot captured' },
        { type: 'image', source: 'data:image/png;base64,...' },
      ],
    },
  ])
  assert.equal(result.length, 1)
  const block = result[0]
  assert.equal(block.kind, 'tool_result')
  if (block.kind === 'tool_result') {
    assert.equal(block.output, 'screenshot captured\n[image]')
  }
})

test('blocksFromAnthropicContent: tool_result with null content yields empty output', () => {
  const result = blocksFromAnthropicContent([
    {
      type: 'tool_result',
      tool_use_id: 'tu_null',
      content: null,
    },
  ])
  assert.equal(result.length, 1)
  const block = result[0]
  assert.equal(block.kind, 'tool_result')
  if (block.kind === 'tool_result') {
    assert.equal(block.output, '')
  }
})

// ── { type: 'image' } block ───────────────────────────────────────────────────

test('blocksFromAnthropicContent: image block maps to { kind: "image" }', () => {
  const result = blocksFromAnthropicContent([
    { type: 'image', source: { type: 'base64', media_type: 'image/png', data: 'abc' } },
  ])
  assert.equal(result.length, 1)
  const block = result[0]
  assert.equal(block.kind, 'image')
  if (block.kind === 'image') {
    assert.equal(block.mime, 'image/*')
    assert.equal(block.source, '[image]')
  }
})

// ── unknown / unsupported types ───────────────────────────────────────────────

test('blocksFromAnthropicContent: unknown type is skipped', () => {
  const result = blocksFromAnthropicContent([
    { type: 'unsupported_future_type', data: 'something' },
  ])
  assert.deepEqual(result, [])
})

test('blocksFromAnthropicContent: mixed blocks — unknown types are skipped, known types are kept', () => {
  const result = blocksFromAnthropicContent([
    { type: 'text', text: 'hello' },
    { type: 'unknown_type', data: 'ignored' },
    { type: 'thinking', thinking: 'pondering' },
  ])
  assert.equal(result.length, 2)
  assert.equal(result[0].kind, 'text')
  assert.equal(result[1].kind, 'thinking')
})

// ── array with non-object entries ─────────────────────────────────────────────

test('blocksFromAnthropicContent: array with null entries skips nulls', () => {
  const result = blocksFromAnthropicContent([
    null,
    { type: 'text', text: 'kept' },
    null,
  ])
  assert.equal(result.length, 1)
  assert.equal(result[0].kind, 'text')
})

test('blocksFromAnthropicContent: array with string entries skips strings', () => {
  const result = blocksFromAnthropicContent([
    'bare string in array',
    { type: 'text', text: 'valid block' },
  ])
  assert.equal(result.length, 1)
  assert.equal(result[0].kind, 'text')
})

// ── multiple blocks in a single call ─────────────────────────────────────────

test('blocksFromAnthropicContent: multiple blocks are all mapped in order', () => {
  const result = blocksFromAnthropicContent([
    { type: 'thinking', thinking: 'I need to use a tool' },
    { type: 'tool_use', id: 'tu_1', name: 'read_file', input: { path: '/etc/hosts' } },
    { type: 'text', text: 'Here is the result' },
  ])
  assert.equal(result.length, 3)
  assert.equal(result[0].kind, 'thinking')
  assert.equal(result[1].kind, 'tool_use')
  assert.equal(result[2].kind, 'text')
})
