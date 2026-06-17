/**
 * Pure-helper tests for src/features/sessions/lib/aggregate.ts (node:test).
 *
 * All four functions — `rollupByProject`, `sortSessions`, `toolFrequency`, and
 * `transcriptStats` — are deterministic and side-effect-free: no disk access,
 * no IPC, no React. They can be exercised directly under tsx.
 */

import { test } from 'node:test'
import assert from 'node:assert/strict'

import {
  rollupByProject,
  sortSessions,
  toolFrequency,
  transcriptStats,
  totalTokens,
  sessionCostUsd,
} from '@/features/sessions/lib/aggregate'
import type { ChatSessionMeta, ChatMessage } from '@/shared/types/chat'

// ── helpers ───────────────────────────────────────────────────────────────────

function makeSession(overrides: Partial<ChatSessionMeta> = {}): ChatSessionMeta {
  return {
    id: 'session-1',
    agentId: 'claude',
    title: 'Test session',
    cwd: '/home/user/project',
    projectLabel: 'project',
    messageCount: 10,
    sizeBytes: 1024,
    filePath: '/home/user/.claude/session-1.jsonl',
    ...overrides,
  }
}

function textMessage(text: string, role: ChatMessage['role'] = 'user'): ChatMessage {
  return {
    id: 'msg-1',
    role,
    blocks: [{ kind: 'text', text }],
  }
}

function toolUseMessage(name: string): ChatMessage {
  return {
    id: `msg-tool-${name}`,
    role: 'assistant',
    blocks: [{ kind: 'tool_use', id: `tu-${name}`, name, input: {} }],
  }
}

function toolResultMessage(isError = false): ChatMessage {
  return {
    id: 'msg-result',
    role: 'user',
    blocks: [
      { kind: 'tool_result', toolUseId: 'tu-1', output: 'output', isError },
    ],
  }
}

// ── totalTokens ───────────────────────────────────────────────────────────────

test('totalTokens: returns 0 when both inputTokens and outputTokens are undefined', () => {
  const session = makeSession({ inputTokens: undefined, outputTokens: undefined })
  assert.equal(totalTokens(session), 0)
})

test('totalTokens: sums inputTokens and outputTokens', () => {
  const session = makeSession({ inputTokens: 300, outputTokens: 100 })
  assert.equal(totalTokens(session), 400)
})

test('totalTokens: handles undefined inputTokens (treats as 0)', () => {
  const session = makeSession({ inputTokens: undefined, outputTokens: 50 })
  assert.equal(totalTokens(session), 50)
})

test('totalTokens: handles undefined outputTokens (treats as 0)', () => {
  const session = makeSession({ inputTokens: 200, outputTokens: undefined })
  assert.equal(totalTokens(session), 200)
})

// ── sessionCostUsd ────────────────────────────────────────────────────────────

test('sessionCostUsd: returns 0 for session with no tokens', () => {
  const session = makeSession({ inputTokens: undefined, outputTokens: undefined })
  assert.equal(sessionCostUsd(session), 0)
})

test('sessionCostUsd: returns a positive number for session with tokens', () => {
  const session = makeSession({ inputTokens: 1_000_000, outputTokens: 1_000_000 })
  assert.ok(sessionCostUsd(session) > 0)
})

// ── rollupByProject ───────────────────────────────────────────────────────────

test('rollupByProject: returns empty array for empty input', () => {
  const result = rollupByProject([])
  assert.deepEqual(result, [])
})

test('rollupByProject: single session produces one rollup entry', () => {
  const session = makeSession({ cwd: '/home/user/myapp', projectLabel: 'myapp', messageCount: 5 })
  const result = rollupByProject([session])
  assert.equal(result.length, 1)
  assert.equal(result[0].cwd, '/home/user/myapp')
  assert.equal(result[0].label, 'myapp')
  assert.equal(result[0].sessions, 1)
  assert.equal(result[0].messages, 5)
})

test('rollupByProject: groups sessions by cwd', () => {
  const sessions: ChatSessionMeta[] = [
    makeSession({ id: 's1', cwd: '/home/user/app1', projectLabel: 'app1', messageCount: 3 }),
    makeSession({ id: 's2', cwd: '/home/user/app2', projectLabel: 'app2', messageCount: 7 }),
    makeSession({ id: 's3', cwd: '/home/user/app1', projectLabel: 'app1', messageCount: 5 }),
  ]
  const result = rollupByProject(sessions)
  assert.equal(result.length, 2)

  const app1 = result.find((r) => r.cwd === '/home/user/app1')
  assert.ok(app1)
  assert.equal(app1.sessions, 2)
  assert.equal(app1.messages, 8)

  const app2 = result.find((r) => r.cwd === '/home/user/app2')
  assert.ok(app2)
  assert.equal(app2.sessions, 1)
  assert.equal(app2.messages, 7)
})

test('rollupByProject: accumulates tokens across sessions in the same project', () => {
  const sessions: ChatSessionMeta[] = [
    makeSession({ id: 's1', cwd: '/home/user/proj', inputTokens: 100, outputTokens: 50 }),
    makeSession({ id: 's2', cwd: '/home/user/proj', inputTokens: 200, outputTokens: 75 }),
  ]
  const result = rollupByProject(sessions)
  assert.equal(result.length, 1)
  assert.equal(result[0].tokens, 425)
})

test('rollupByProject: accumulates tokens when some sessions have undefined tokens', () => {
  const sessions: ChatSessionMeta[] = [
    makeSession({ id: 's1', cwd: '/home/user/proj', inputTokens: 100, outputTokens: undefined }),
    makeSession({ id: 's2', cwd: '/home/user/proj', inputTokens: undefined, outputTokens: 50 }),
  ]
  const result = rollupByProject(sessions)
  assert.equal(result.length, 1)
  assert.equal(result[0].tokens, 150)
})

test('rollupByProject: accumulates estCostUsd across sessions', () => {
  const sessions: ChatSessionMeta[] = [
    makeSession({ id: 's1', cwd: '/home/user/proj', inputTokens: 1_000_000, outputTokens: 0 }),
    makeSession({ id: 's2', cwd: '/home/user/proj', inputTokens: 0, outputTokens: 0 }),
  ]
  const result = rollupByProject(sessions)
  assert.ok(result[0].estCostUsd > 0)
})

test('rollupByProject: sorts results by tokens descending (busiest first)', () => {
  const sessions: ChatSessionMeta[] = [
    makeSession({ id: 's1', cwd: '/home/user/small', inputTokens: 100, outputTokens: 0 }),
    makeSession({ id: 's2', cwd: '/home/user/large', inputTokens: 10_000, outputTokens: 0 }),
    makeSession({ id: 's3', cwd: '/home/user/medium', inputTokens: 500, outputTokens: 0 }),
  ]
  const result = rollupByProject(sessions)
  assert.equal(result[0].cwd, '/home/user/large')
  assert.equal(result[1].cwd, '/home/user/medium')
  assert.equal(result[2].cwd, '/home/user/small')
})

test('rollupByProject: tracks lastActivityAt as most recent updatedAt', () => {
  const sessions: ChatSessionMeta[] = [
    makeSession({ id: 's1', cwd: '/home/user/proj', updatedAt: '2024-01-01T10:00:00Z' }),
    makeSession({ id: 's2', cwd: '/home/user/proj', updatedAt: '2024-01-05T10:00:00Z' }),
    makeSession({ id: 's3', cwd: '/home/user/proj', updatedAt: '2024-01-03T10:00:00Z' }),
  ]
  const result = rollupByProject(sessions)
  assert.equal(result.length, 1)
  assert.equal(result[0].lastActivityAt, '2024-01-05T10:00:00Z')
})

test('rollupByProject: falls back to startedAt when updatedAt is absent', () => {
  const sessions: ChatSessionMeta[] = [
    makeSession({ id: 's1', cwd: '/home/user/proj', updatedAt: undefined, startedAt: '2024-02-10T08:00:00Z' }),
  ]
  const result = rollupByProject(sessions)
  assert.equal(result[0].lastActivityAt, '2024-02-10T08:00:00Z')
})

test('rollupByProject: lastActivityAt is undefined when sessions have no timestamps', () => {
  const sessions: ChatSessionMeta[] = [
    makeSession({ id: 's1', cwd: '/home/user/proj', updatedAt: undefined, startedAt: undefined }),
  ]
  const result = rollupByProject(sessions)
  assert.equal(result[0].lastActivityAt, undefined)
})

test('rollupByProject: falls back to projectLabel as key when cwd is empty string', () => {
  const sessions: ChatSessionMeta[] = [
    makeSession({ id: 's1', cwd: '', projectLabel: 'myproject', messageCount: 4 }),
  ]
  const result = rollupByProject(sessions)
  assert.equal(result.length, 1)
  assert.equal(result[0].label, 'myproject')
  assert.equal(result[0].messages, 4)
})

// ── sortSessions ──────────────────────────────────────────────────────────────

const SESSION_A = makeSession({
  id: 'a',
  projectLabel: 'alpha',
  messageCount: 5,
  inputTokens: 200,
  outputTokens: 100,
  updatedAt: '2024-01-01T00:00:00Z',
})

const SESSION_B = makeSession({
  id: 'b',
  projectLabel: 'beta',
  messageCount: 10,
  inputTokens: 100,
  outputTokens: 50,
  updatedAt: '2024-02-01T00:00:00Z',
})

const SESSION_C = makeSession({
  id: 'c',
  projectLabel: 'gamma',
  messageCount: 3,
  inputTokens: 500,
  outputTokens: 200,
  updatedAt: '2024-01-15T00:00:00Z',
})

const THREE_SESSIONS = [SESSION_A, SESSION_B, SESSION_C]

test('sortSessions: does not mutate the original array', () => {
  const original = [...THREE_SESSIONS]
  sortSessions(THREE_SESSIONS, 'messages', 'asc')
  assert.deepEqual(THREE_SESSIONS, original)
})

test('sortSessions: project asc sorts alphabetically by projectLabel', () => {
  const result = sortSessions(THREE_SESSIONS, 'project', 'asc')
  assert.equal(result[0].projectLabel, 'alpha')
  assert.equal(result[1].projectLabel, 'beta')
  assert.equal(result[2].projectLabel, 'gamma')
})

test('sortSessions: project desc sorts reverse-alphabetically by projectLabel', () => {
  const result = sortSessions(THREE_SESSIONS, 'project', 'desc')
  assert.equal(result[0].projectLabel, 'gamma')
  assert.equal(result[1].projectLabel, 'beta')
  assert.equal(result[2].projectLabel, 'alpha')
})

test('sortSessions: messages asc sorts by messageCount ascending', () => {
  const result = sortSessions(THREE_SESSIONS, 'messages', 'asc')
  assert.equal(result[0].messageCount, 3)
  assert.equal(result[1].messageCount, 5)
  assert.equal(result[2].messageCount, 10)
})

test('sortSessions: messages desc sorts by messageCount descending', () => {
  const result = sortSessions(THREE_SESSIONS, 'messages', 'desc')
  assert.equal(result[0].messageCount, 10)
  assert.equal(result[1].messageCount, 5)
  assert.equal(result[2].messageCount, 3)
})

test('sortSessions: tokens asc sorts by total tokens ascending', () => {
  // A: 200+100=300, B: 100+50=150, C: 500+200=700
  const result = sortSessions(THREE_SESSIONS, 'tokens', 'asc')
  assert.equal(result[0].id, 'b') // 150
  assert.equal(result[1].id, 'a') // 300
  assert.equal(result[2].id, 'c') // 700
})

test('sortSessions: tokens desc sorts by total tokens descending', () => {
  const result = sortSessions(THREE_SESSIONS, 'tokens', 'desc')
  assert.equal(result[0].id, 'c') // 700
  assert.equal(result[1].id, 'a') // 300
  assert.equal(result[2].id, 'b') // 150
})

test('sortSessions: cost asc sorts by estimated cost ascending', () => {
  // C has more tokens so higher cost, then A, then B
  const result = sortSessions(THREE_SESSIONS, 'cost', 'asc')
  // B has lowest tokens, so lowest cost
  assert.equal(result[0].id, 'b')
  assert.equal(result[2].id, 'c')
})

test('sortSessions: cost desc sorts by estimated cost descending', () => {
  const result = sortSessions(THREE_SESSIONS, 'cost', 'desc')
  assert.equal(result[0].id, 'c')
  assert.equal(result[2].id, 'b')
})

test('sortSessions: updatedAt asc sorts oldest first', () => {
  const result = sortSessions(THREE_SESSIONS, 'updatedAt', 'asc')
  assert.equal(result[0].updatedAt, '2024-01-01T00:00:00Z')
  assert.equal(result[1].updatedAt, '2024-01-15T00:00:00Z')
  assert.equal(result[2].updatedAt, '2024-02-01T00:00:00Z')
})

test('sortSessions: updatedAt desc sorts newest first', () => {
  const result = sortSessions(THREE_SESSIONS, 'updatedAt', 'desc')
  assert.equal(result[0].updatedAt, '2024-02-01T00:00:00Z')
  assert.equal(result[1].updatedAt, '2024-01-15T00:00:00Z')
  assert.equal(result[2].updatedAt, '2024-01-01T00:00:00Z')
})

test('sortSessions: updatedAt falls back to startedAt when updatedAt is absent', () => {
  const sessions: ChatSessionMeta[] = [
    makeSession({ id: 'x', updatedAt: undefined, startedAt: '2024-03-01T00:00:00Z' }),
    makeSession({ id: 'y', updatedAt: '2024-03-15T00:00:00Z', startedAt: undefined }),
  ]
  const result = sortSessions(sessions, 'updatedAt', 'asc')
  assert.equal(result[0].id, 'x')
  assert.equal(result[1].id, 'y')
})

test('sortSessions: empty input returns empty array', () => {
  const result = sortSessions([], 'messages', 'asc')
  assert.deepEqual(result, [])
})

// ── toolFrequency ─────────────────────────────────────────────────────────────

test('toolFrequency: returns empty array for empty messages', () => {
  const result = toolFrequency([])
  assert.deepEqual(result, [])
})

test('toolFrequency: counts single tool_use block', () => {
  const messages: ChatMessage[] = [toolUseMessage('bash')]
  const result = toolFrequency(messages)
  assert.equal(result.length, 1)
  assert.equal(result[0].name, 'bash')
  assert.equal(result[0].count, 1)
})

test('toolFrequency: counts multiple tool_use blocks of the same tool', () => {
  const messages: ChatMessage[] = [
    toolUseMessage('bash'),
    toolUseMessage('bash'),
    toolUseMessage('bash'),
  ]
  const result = toolFrequency(messages)
  assert.equal(result.length, 1)
  assert.equal(result[0].name, 'bash')
  assert.equal(result[0].count, 3)
})

test('toolFrequency: counts distinct tools separately', () => {
  const messages: ChatMessage[] = [
    toolUseMessage('bash'),
    toolUseMessage('read_file'),
    toolUseMessage('bash'),
    toolUseMessage('write_file'),
  ]
  const result = toolFrequency(messages)
  assert.equal(result.length, 3)
  const bash = result.find((t) => t.name === 'bash')
  assert.ok(bash)
  assert.equal(bash.count, 2)
})

test('toolFrequency: ignores non-tool blocks (text, tool_result, thinking)', () => {
  const messages: ChatMessage[] = [
    textMessage('some text'),
    { id: 'tr', role: 'user', blocks: [{ kind: 'tool_result', toolUseId: 'x', output: 'y' }] },
    { id: 'th', role: 'assistant', blocks: [{ kind: 'thinking', text: 'hmm' }] },
  ]
  const result = toolFrequency(messages)
  assert.deepEqual(result, [])
})

test('toolFrequency: sorts results descending by count (busiest tool first)', () => {
  const messages: ChatMessage[] = [
    toolUseMessage('bash'),
    toolUseMessage('read_file'),
    toolUseMessage('bash'),
    toolUseMessage('read_file'),
    toolUseMessage('bash'),
    toolUseMessage('write_file'),
  ]
  const result = toolFrequency(messages)
  assert.equal(result[0].name, 'bash')
  assert.equal(result[0].count, 3)
  assert.equal(result[1].name, 'read_file')
  assert.equal(result[1].count, 2)
  assert.equal(result[2].name, 'write_file')
  assert.equal(result[2].count, 1)
})

test('toolFrequency: counts tool_use blocks across mixed messages', () => {
  const messages: ChatMessage[] = [
    {
      id: 'multi',
      role: 'assistant',
      blocks: [
        { kind: 'text', text: 'calling tools' },
        { kind: 'tool_use', id: 'tu-1', name: 'bash', input: {} },
        { kind: 'tool_use', id: 'tu-2', name: 'read_file', input: {} },
      ],
    },
  ]
  const result = toolFrequency(messages)
  assert.equal(result.length, 2)
  const bash = result.find((t) => t.name === 'bash')
  assert.ok(bash)
  assert.equal(bash.count, 1)
})

// ── transcriptStats ───────────────────────────────────────────────────────────

test('transcriptStats: returns all zeros for empty messages', () => {
  const result = transcriptStats([])
  assert.deepEqual(result, { userTurns: 0, assistantTurns: 0, toolCalls: 0, toolErrors: 0 })
})

test('transcriptStats: counts user turns', () => {
  const messages: ChatMessage[] = [
    textMessage('hello', 'user'),
    textMessage('world', 'user'),
  ]
  const result = transcriptStats(messages)
  assert.equal(result.userTurns, 2)
  assert.equal(result.assistantTurns, 0)
})

test('transcriptStats: counts assistant turns', () => {
  const messages: ChatMessage[] = [
    textMessage('hi', 'assistant'),
    textMessage('there', 'assistant'),
    textMessage('again', 'assistant'),
  ]
  const result = transcriptStats(messages)
  assert.equal(result.userTurns, 0)
  assert.equal(result.assistantTurns, 3)
})

test('transcriptStats: counts mixed user and assistant turns', () => {
  const messages: ChatMessage[] = [
    textMessage('question', 'user'),
    textMessage('answer', 'assistant'),
    textMessage('follow-up', 'user'),
  ]
  const result = transcriptStats(messages)
  assert.equal(result.userTurns, 2)
  assert.equal(result.assistantTurns, 1)
})

test('transcriptStats: counts tool_use blocks as toolCalls', () => {
  const messages: ChatMessage[] = [
    {
      id: 'm1',
      role: 'assistant',
      blocks: [
        { kind: 'tool_use', id: 'tu-1', name: 'bash', input: {} },
        { kind: 'tool_use', id: 'tu-2', name: 'read_file', input: {} },
      ],
    },
  ]
  const result = transcriptStats(messages)
  assert.equal(result.toolCalls, 2)
})

test('transcriptStats: counts tool_result blocks with isError:true as toolErrors', () => {
  const messages: ChatMessage[] = [
    toolResultMessage(true),
    toolResultMessage(true),
    toolResultMessage(false),
  ]
  const result = transcriptStats(messages)
  assert.equal(result.toolErrors, 2)
})

test('transcriptStats: does not count tool_result with isError:false as toolErrors', () => {
  const messages: ChatMessage[] = [toolResultMessage(false)]
  const result = transcriptStats(messages)
  assert.equal(result.toolErrors, 0)
})

test('transcriptStats: handles message with multiple block types', () => {
  const messages: ChatMessage[] = [
    {
      id: 'm1',
      role: 'assistant',
      blocks: [
        { kind: 'text', text: 'working on it' },
        { kind: 'tool_use', id: 'tu-1', name: 'bash', input: {} },
        { kind: 'tool_result', toolUseId: 'tu-1', output: 'ok', isError: false },
      ],
    },
  ]
  const result = transcriptStats(messages)
  assert.equal(result.assistantTurns, 1)
  assert.equal(result.toolCalls, 1)
  assert.equal(result.toolErrors, 0)
})

test('transcriptStats: accumulates correctly across many messages', () => {
  const messages: ChatMessage[] = [
    textMessage('q1', 'user'),       // user turn 1
    toolUseMessage('bash'),           // assistant turn 1 (contains 1 tool_use)
    toolResultMessage(false),         // user turn 2 (contains 1 tool_result, not error)
    toolResultMessage(true),          // user turn 3 (contains 1 tool_result, isError)
    textMessage('a1', 'assistant'),   // assistant turn 2
    textMessage('q2', 'user'),        // user turn 4
  ]
  const result = transcriptStats(messages)
  assert.equal(result.userTurns, 4)
  assert.equal(result.assistantTurns, 2)
  assert.equal(result.toolCalls, 1)
  assert.equal(result.toolErrors, 1)
})
