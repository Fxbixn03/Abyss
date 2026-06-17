/**
 * Pure-logic tests for core/chat/insights.ts (node:test).
 * Both `looksLikeCorrection` and `frictionForTranscript` are deterministic and
 * side-effect-free — no disk access, no IPC, no React — so these tests are
 * cheap and CI-safe.
 */

import { test } from 'node:test'
import assert from 'node:assert/strict'

import {
  looksLikeCorrection,
  frictionForTranscript,
} from '../core/chat/insights'
import type { ChatMessage, ChatSessionMeta } from '@/shared/types/chat'

// ── helpers ───────────────────────────────────────────────────────────────────

function textMessage(text: string, role: ChatMessage['role'] = 'user'): ChatMessage {
  return {
    id: 'msg-1',
    role,
    blocks: [{ kind: 'text', text }],
  }
}

function toolUseMessage(name: string, input: unknown): ChatMessage {
  return {
    id: `tu-${name}`,
    role: 'assistant',
    blocks: [{ kind: 'tool_use', id: `tu-id-${name}`, name, input }],
  }
}

function toolResultMessage(isError: boolean): ChatMessage {
  return {
    id: 'tr-1',
    role: 'user',
    blocks: [{ kind: 'tool_result', toolUseId: 'tu-id-1', output: 'error output', isError }],
  }
}

const baseMeta: ChatSessionMeta = {
  id: 'session-1',
  agentId: 'claude',
  title: 'Test Session',
  cwd: '/home/user/project',
  projectLabel: 'project',
  messageCount: 0,
  sizeBytes: 0,
  filePath: '/home/user/.claude/sessions/session-1.jsonl',
}

// ── looksLikeCorrection — edge cases ─────────────────────────────────────────

test('looksLikeCorrection: empty string returns false', () => {
  assert.equal(looksLikeCorrection(''), false)
})

test('looksLikeCorrection: whitespace-only string returns false', () => {
  assert.equal(looksLikeCorrection('   '), false)
})

test('looksLikeCorrection: text longer than 240 chars returns false', () => {
  const longText = 'no '.repeat(82) // > 240 chars
  assert.ok(longText.trim().length > 240)
  assert.equal(looksLikeCorrection(longText), false)
})

test('looksLikeCorrection: unrelated short text returns false', () => {
  assert.equal(looksLikeCorrection('please continue with the implementation'), false)
})

// ── looksLikeCorrection — CORRECTION_PATTERNS ─────────────────────────────────

test('looksLikeCorrection: pattern /^no\\b/ fires on "no, that is wrong"', () => {
  assert.equal(looksLikeCorrection('no, that is wrong'), true)
})

test('looksLikeCorrection: pattern /^nope\\b/ fires on "nope, try again"', () => {
  assert.equal(looksLikeCorrection("nope, try again"), true)
})

test('looksLikeCorrection: pattern /^stop\\b/ fires on "stop doing that"', () => {
  assert.equal(looksLikeCorrection('stop doing that'), true)
})

test('looksLikeCorrection: pattern /^wait\\b/ fires on "wait, not this"', () => {
  assert.equal(looksLikeCorrection('wait, not this'), true)
})

test('looksLikeCorrection: pattern /^actually\\b/ fires on "actually wait"', () => {
  assert.equal(looksLikeCorrection('actually wait'), true)
})

test("looksLikeCorrection: pattern /^don't\\b/ fires on \"don't do that\"", () => {
  assert.equal(looksLikeCorrection("don't do that"), true)
})

test("looksLikeCorrection: pattern /^don't\\b/ fires on \"dont do that\" (without apostrophe)", () => {
  assert.equal(looksLikeCorrection('dont do that'), true)
})

test('looksLikeCorrection: pattern /^undo\\b/ fires on "undo that change"', () => {
  assert.equal(looksLikeCorrection('undo that change'), true)
})

test('looksLikeCorrection: pattern /^revert\\b/ fires on "revert this"', () => {
  assert.equal(looksLikeCorrection('revert this'), true)
})

test("looksLikeCorrection: pattern /that's (not|wrong)/ fires on \"that's not what i asked\"", () => {
  assert.equal(looksLikeCorrection("that's not what i asked"), true)
})

test("looksLikeCorrection: pattern /that's (not|wrong)/ fires on \"that's wrong\"", () => {
  assert.equal(looksLikeCorrection("that's wrong"), true)
})

test('looksLikeCorrection: pattern /not what i/ fires on "not what i meant"', () => {
  assert.equal(looksLikeCorrection('not what i meant'), true)
})

test('looksLikeCorrection: pattern /\\binstead\\b/ fires on "do this instead"', () => {
  assert.equal(looksLikeCorrection('do this instead'), true)
})

test('looksLikeCorrection: pattern /\\bwrong\\b/ fires on "that is wrong"', () => {
  assert.equal(looksLikeCorrection('that is wrong'), true)
})

test('looksLikeCorrection: is case-insensitive — "NO, THAT IS WRONG" returns true', () => {
  assert.equal(looksLikeCorrection('NO, THAT IS WRONG'), true)
})

// ── frictionForTranscript — empty messages ────────────────────────────────────

test('frictionForTranscript: empty messages array returns score 0 and all counts 0', () => {
  const result = frictionForTranscript(baseMeta, [])
  assert.equal(result.score, 0)
  assert.equal(result.corrections, 0)
  assert.equal(result.toolErrors, 0)
  assert.equal(result.toolCalls, 0)
  assert.equal(result.redundantCalls, 0)
  assert.equal(result.messages, 0)
})

test('frictionForTranscript: returns correct sessionId and title from meta', () => {
  const result = frictionForTranscript(baseMeta, [])
  assert.equal(result.sessionId, baseMeta.id)
  assert.equal(result.title, baseMeta.title)
})

// ── frictionForTranscript — correction detection ──────────────────────────────

test('frictionForTranscript: user correction message increments corrections and contributes 14 to score', () => {
  const messages: ChatMessage[] = [textMessage('no, that is wrong', 'user')]
  const result = frictionForTranscript(baseMeta, messages)
  assert.equal(result.corrections, 1)
  assert.equal(result.score, 14)
})

test('frictionForTranscript: assistant correction message does NOT increment corrections', () => {
  const messages: ChatMessage[] = [textMessage('no, that is wrong', 'assistant')]
  const result = frictionForTranscript(baseMeta, messages)
  assert.equal(result.corrections, 0)
  assert.equal(result.score, 0)
})

test('frictionForTranscript: two user correction messages contribute 28 to score', () => {
  const messages: ChatMessage[] = [
    textMessage('no, that is wrong', 'user'),
    textMessage('actually wait', 'user'),
  ]
  const result = frictionForTranscript(baseMeta, messages)
  assert.equal(result.corrections, 2)
  assert.equal(result.score, 28)
})

// ── frictionForTranscript — tool errors ──────────────────────────────────────

test('frictionForTranscript: tool_result block with isError: true increments toolErrors and contributes 9 to score', () => {
  const messages: ChatMessage[] = [toolResultMessage(true)]
  const result = frictionForTranscript(baseMeta, messages)
  assert.equal(result.toolErrors, 1)
  assert.equal(result.score, 9)
})

test('frictionForTranscript: tool_result block with isError: false does NOT increment toolErrors', () => {
  const messages: ChatMessage[] = [toolResultMessage(false)]
  const result = frictionForTranscript(baseMeta, messages)
  assert.equal(result.toolErrors, 0)
  assert.equal(result.score, 0)
})

test('frictionForTranscript: two tool_result error blocks contribute 18 to score', () => {
  const messages: ChatMessage[] = [toolResultMessage(true), toolResultMessage(true)]
  const result = frictionForTranscript(baseMeta, messages)
  assert.equal(result.toolErrors, 2)
  assert.equal(result.score, 18)
})

// ── frictionForTranscript — redundant tool calls ──────────────────────────────

test('frictionForTranscript: two identical tool_use blocks mark second as redundant and contribute 5 to score', () => {
  const messages: ChatMessage[] = [
    toolUseMessage('bash', { command: 'ls' }),
    toolUseMessage('bash', { command: 'ls' }),
  ]
  const result = frictionForTranscript(baseMeta, messages)
  assert.equal(result.toolCalls, 2)
  assert.equal(result.redundantCalls, 1)
  assert.equal(result.score, 5)
})

test('frictionForTranscript: tool_use block without a matching repeated call does NOT increment redundantCalls', () => {
  const messages: ChatMessage[] = [
    toolUseMessage('bash', { command: 'ls' }),
    toolUseMessage('bash', { command: 'pwd' }),
  ]
  const result = frictionForTranscript(baseMeta, messages)
  assert.equal(result.toolCalls, 2)
  assert.equal(result.redundantCalls, 0)
  assert.equal(result.score, 0)
})

test('frictionForTranscript: three identical tool_use blocks mark second and third as redundant', () => {
  const messages: ChatMessage[] = [
    toolUseMessage('read', { path: '/tmp/file.txt' }),
    toolUseMessage('read', { path: '/tmp/file.txt' }),
    toolUseMessage('read', { path: '/tmp/file.txt' }),
  ]
  const result = frictionForTranscript(baseMeta, messages)
  assert.equal(result.toolCalls, 3)
  assert.equal(result.redundantCalls, 2)
  assert.equal(result.score, 10)
})

test('frictionForTranscript: single tool_use block does not increment redundantCalls', () => {
  const messages: ChatMessage[] = [toolUseMessage('bash', { command: 'ls' })]
  const result = frictionForTranscript(baseMeta, messages)
  assert.equal(result.toolCalls, 1)
  assert.equal(result.redundantCalls, 0)
})

// ── frictionForTranscript — score capping ─────────────────────────────────────

test('frictionForTranscript: score is capped at 100 for pathological transcripts', () => {
  // corrections * 14 would exceed 100 with 8+ corrections
  const messages: ChatMessage[] = Array.from({ length: 20 }, () =>
    textMessage('no, that is wrong', 'user'),
  )
  const result = frictionForTranscript(baseMeta, messages)
  assert.equal(result.corrections, 20)
  assert.equal(result.score, 100) // capped, not 280
})

test('frictionForTranscript: mixed signals do not exceed 100', () => {
  // 5 corrections (70) + 5 tool errors (45) = 115 → capped at 100
  const correctionMessages: ChatMessage[] = Array.from({ length: 5 }, () =>
    textMessage('revert this', 'user'),
  )
  const errorMessages: ChatMessage[] = Array.from({ length: 5 }, () =>
    toolResultMessage(true),
  )
  const result = frictionForTranscript(baseMeta, [
    ...correctionMessages,
    ...errorMessages,
  ])
  assert.equal(result.score, 100)
})

// ── frictionForTranscript — message count ────────────────────────────────────

test('frictionForTranscript: messages field reflects the total number of messages', () => {
  const messages: ChatMessage[] = [
    textMessage('hello', 'user'),
    textMessage('world', 'assistant'),
    textMessage('yes', 'user'),
  ]
  const result = frictionForTranscript(baseMeta, messages)
  assert.equal(result.messages, 3)
})
