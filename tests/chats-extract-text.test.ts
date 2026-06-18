/**
 * Pure-logic tests for extractMessageText in src/features/chats/lib/format.ts
 * (node:test). The function is deterministic and has no disk, IPC, or DOM
 * dependencies.
 */

import { test } from 'node:test'
import assert from 'node:assert/strict'

import { extractMessageText } from '@/features/chats/lib/format'
import type { ChatMessage } from '@/shared/types/chat'

// ── (a) single text block ─────────────────────────────────────────────────────

test('extractMessageText: message with one text block returns its text', () => {
  const message: ChatMessage = {
    id: 'msg-1',
    role: 'assistant',
    blocks: [{ kind: 'text', text: 'Hello, world!' }],
  }
  assert.equal(extractMessageText(message), 'Hello, world!')
})

// ── (b) multiple text blocks joined with a space ──────────────────────────────

test('extractMessageText: message with multiple text blocks joins them with a space', () => {
  const message: ChatMessage = {
    id: 'msg-2',
    role: 'assistant',
    blocks: [
      { kind: 'text', text: 'First part.' },
      { kind: 'text', text: 'Second part.' },
      { kind: 'text', text: 'Third part.' },
    ],
  }
  assert.equal(extractMessageText(message), 'First part. Second part. Third part.')
})

// ── (c) no text blocks (only tool_use/tool_result) returns empty string ───────

test('extractMessageText: message with only tool_use block returns empty string', () => {
  const message: ChatMessage = {
    id: 'msg-3',
    role: 'assistant',
    blocks: [{ kind: 'tool_use', id: 'tu-1', name: 'bash', input: { command: 'ls' } }],
  }
  assert.equal(extractMessageText(message), '')
})

test('extractMessageText: message with only tool_result block returns empty string', () => {
  const message: ChatMessage = {
    id: 'msg-4',
    role: 'assistant',
    blocks: [{ kind: 'tool_result', toolUseId: 'tu-1', output: 'file.txt', isError: false }],
  }
  assert.equal(extractMessageText(message), '')
})

test('extractMessageText: message with tool_use and tool_result but no text returns empty string', () => {
  const message: ChatMessage = {
    id: 'msg-5',
    role: 'assistant',
    blocks: [
      { kind: 'tool_use', id: 'tu-2', name: 'read_file', input: { path: '/tmp/x' } },
      { kind: 'tool_result', toolUseId: 'tu-2', output: 'content here' },
    ],
  }
  assert.equal(extractMessageText(message), '')
})

// ── (d) empty blocks array returns empty string ───────────────────────────────

test('extractMessageText: empty blocks array returns empty string', () => {
  const message: ChatMessage = {
    id: 'msg-6',
    role: 'user',
    blocks: [],
  }
  assert.equal(extractMessageText(message), '')
})

// ── (e) mixed blocks returns only text-block content ─────────────────────────

test('extractMessageText: mixed blocks returns only text-block content joined with space', () => {
  const message: ChatMessage = {
    id: 'msg-7',
    role: 'assistant',
    blocks: [
      { kind: 'text', text: 'Looking at the file.' },
      { kind: 'tool_use', id: 'tu-3', name: 'read_file', input: { path: '/tmp/foo' } },
      { kind: 'tool_result', toolUseId: 'tu-3', output: 'file contents here' },
      { kind: 'text', text: 'Done reading.' },
    ],
  }
  assert.equal(extractMessageText(message), 'Looking at the file. Done reading.')
})

test('extractMessageText: ignores thinking blocks and only extracts text blocks', () => {
  const message: ChatMessage = {
    id: 'msg-8',
    role: 'assistant',
    blocks: [
      { kind: 'thinking', text: 'Internal reasoning goes here.' },
      { kind: 'text', text: 'Here is my answer.' },
    ],
  }
  assert.equal(extractMessageText(message), 'Here is my answer.')
})

test('extractMessageText: ignores error blocks and only extracts text blocks', () => {
  const message: ChatMessage = {
    id: 'msg-9',
    role: 'assistant',
    blocks: [
      { kind: 'text', text: 'Partial output.' },
      { kind: 'error', message: 'Something went wrong.' },
    ],
  }
  assert.equal(extractMessageText(message), 'Partial output.')
})

test('extractMessageText: works for user role messages', () => {
  const message: ChatMessage = {
    id: 'msg-10',
    role: 'user',
    blocks: [{ kind: 'text', text: 'Can you help me?' }],
  }
  assert.equal(extractMessageText(message), 'Can you help me?')
})
