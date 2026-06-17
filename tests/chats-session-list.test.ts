/**
 * Unit tests for the pure sort/group helpers in
 * src/features/chats/lib/session-list.ts (node:test).
 * No React, no IPC, no DOM — fully deterministic.
 */

import { test } from 'node:test'
import assert from 'node:assert/strict'

import {
  sortSessions,
  dateBucket,
  groupSessions,
  DATE_BUCKET_KEY_ORDER,
} from '@/features/chats/lib/session-list'
import type { ChatSessionMeta } from '@/shared/types/chat'

// ── helpers ───────────────────────────────────────────────────────────────────

function makeSession(
  overrides: Partial<ChatSessionMeta> & { id: string },
): ChatSessionMeta {
  return {
    agentId: 'claude',
    title: `Session ${overrides.id}`,
    cwd: '/home/user/project',
    projectLabel: 'project',
    messageCount: 1,
    sizeBytes: 0,
    filePath: `/home/user/.claude/sessions/${overrides.id}.jsonl`,
    ...overrides,
  }
}

// ── sortSessions ──────────────────────────────────────────────────────────────

test('sortSessions: recent returns original order unchanged', () => {
  const sessions = [
    makeSession({ id: 'a', messageCount: 3 }),
    makeSession({ id: 'b', messageCount: 10 }),
    makeSession({ id: 'c', messageCount: 1 }),
  ]
  const result = sortSessions(sessions, 'recent')
  assert.deepEqual(
    result.map((s) => s.id),
    ['a', 'b', 'c'],
  )
})

test('sortSessions: recent returns the same array reference', () => {
  const sessions = [makeSession({ id: 'a' })]
  assert.strictEqual(sortSessions(sessions, 'recent'), sessions)
})

test('sortSessions: longest sorts descending by messageCount', () => {
  const sessions = [
    makeSession({ id: 'a', messageCount: 5 }),
    makeSession({ id: 'b', messageCount: 20 }),
    makeSession({ id: 'c', messageCount: 1 }),
  ]
  const result = sortSessions(sessions, 'longest')
  assert.deepEqual(
    result.map((s) => s.id),
    ['b', 'a', 'c'],
  )
})

test('sortSessions: longest does not mutate the original array', () => {
  const sessions = [
    makeSession({ id: 'a', messageCount: 5 }),
    makeSession({ id: 'b', messageCount: 20 }),
  ]
  sortSessions(sessions, 'longest')
  assert.equal(sessions[0].id, 'a')
})

test('sortSessions: costliest sorts descending by outputTokens', () => {
  const sessions = [
    makeSession({ id: 'a', outputTokens: 100, inputTokens: 50 }),
    makeSession({ id: 'b', outputTokens: 500, inputTokens: 10 }),
    makeSession({ id: 'c', outputTokens: 200, inputTokens: 300 }),
  ]
  const result = sortSessions(sessions, 'costliest')
  assert.deepEqual(
    result.map((s) => s.id),
    ['b', 'c', 'a'],
  )
})

test('sortSessions: costliest falls back to inputTokens when outputTokens is 0', () => {
  const sessions = [
    makeSession({ id: 'a', outputTokens: 0, inputTokens: 100 }),
    makeSession({ id: 'b', outputTokens: 0, inputTokens: 500 }),
  ]
  const result = sortSessions(sessions, 'costliest')
  assert.deepEqual(
    result.map((s) => s.id),
    ['b', 'a'],
  )
})

test('sortSessions: costliest falls back to inputTokens when outputTokens is undefined', () => {
  const sessions = [
    makeSession({ id: 'a', inputTokens: 200 }),
    makeSession({ id: 'b', inputTokens: 800 }),
  ]
  const result = sortSessions(sessions, 'costliest')
  assert.deepEqual(
    result.map((s) => s.id),
    ['b', 'a'],
  )
})

// ── dateBucket ────────────────────────────────────────────────────────────────

test('dateBucket: timestamp from earlier today returns "today"', () => {
  // 1 hour ago — definitely earlier today (unless test runs right after midnight)
  const ts = new Date(Date.now() - 60 * 60 * 1000).toISOString()
  assert.equal(dateBucket(ts), 'today')
})

test('dateBucket: timestamp from exactly now returns "today"', () => {
  assert.equal(dateBucket(new Date()), 'today')
})

test('dateBucket: timestamp from yesterday returns "yesterday"', () => {
  const yesterday = new Date()
  yesterday.setDate(yesterday.getDate() - 1)
  // Use noon yesterday to avoid edge cases near midnight
  yesterday.setHours(12, 0, 0, 0)
  assert.equal(dateBucket(yesterday.toISOString()), 'yesterday')
})

test('dateBucket: timestamp from 3 days ago returns "thisWeek" or older depending on day', () => {
  // 3 days ago is always either thisWeek, thisMonth, or older
  const threeDaysAgo = new Date()
  threeDaysAgo.setDate(threeDaysAgo.getDate() - 3)
  threeDaysAgo.setHours(12, 0, 0, 0)
  const result = dateBucket(threeDaysAgo.toISOString())
  // We cannot assert 'thisWeek' exactly (depends on day of week), but it must not
  // be 'today' or 'yesterday'.
  assert.notEqual(result, 'today')
  assert.notEqual(result, 'yesterday')
})

test('dateBucket: timestamp from start of this month (if > 7 days ago) returns "thisMonth"', () => {
  const now = new Date()
  // Use the 1st at noon — if we are past day 8 it will be thisMonth, not thisWeek
  const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1, 12, 0, 0, 0)
  const dayOfMonth = now.getDate()
  if (dayOfMonth > 8) {
    assert.equal(dateBucket(firstOfMonth.toISOString()), 'thisMonth')
  }
  // When running in the first 8 days of a month the 1st may still be in 'thisWeek';
  // skip the assertion in that case to keep the test deterministic.
})

test('dateBucket: timestamp from 45 days ago returns "older"', () => {
  const old = new Date(Date.now() - 45 * 24 * 60 * 60 * 1000)
  assert.equal(dateBucket(old.toISOString()), 'older')
})

test('dateBucket: undefined input returns "older"', () => {
  // new Date(undefined) is Invalid Date; new Date(0) is epoch (definitely older)
  assert.equal(dateBucket(undefined), 'older')
})

test('dateBucket: epoch (new Date(0)) returns "older"', () => {
  assert.equal(dateBucket(new Date(0)), 'older')
})

// ── groupSessions — date grouping ─────────────────────────────────────────────

test('groupSessions date: places sessions in canonical bucket order', () => {
  const now = new Date()
  const yesterday = new Date(now)
  yesterday.setDate(yesterday.getDate() - 1)
  yesterday.setHours(12, 0, 0, 0)

  const sessions = [
    makeSession({ id: 'old', updatedAt: new Date(Date.now() - 45 * 24 * 60 * 60 * 1000).toISOString() }),
    makeSession({ id: 'today', updatedAt: new Date().toISOString() }),
    makeSession({ id: 'yest', updatedAt: yesterday.toISOString() }),
  ]

  const groups = groupSessions(sessions, 'date', new Set())
  const keys = groups.map(([key]) => key)

  // Keys must appear in DATE_BUCKET_KEY_ORDER order (no guarantee on which keys
  // appear, but whatever does appear must be in order).
  const positions = keys.map((k) => DATE_BUCKET_KEY_ORDER.indexOf(k))
  for (let i = 1; i < positions.length; i++) {
    assert.ok(
      (positions[i] ?? 0) > (positions[i - 1] ?? 0),
      `Bucket order violated: ${keys.join(', ')}`,
    )
  }
})

test('groupSessions date: omits empty buckets', () => {
  const sessions = [
    makeSession({ id: 'today', updatedAt: new Date().toISOString() }),
  ]
  const groups = groupSessions(sessions, 'date', new Set())
  // Only 'today' bucket should exist
  assert.equal(groups.length, 1)
  assert.equal(groups[0]?.[0], 'today')
})

test('groupSessions date: sessions end up in the correct bucket', () => {
  const todayIso = new Date().toISOString()
  const sessions = [makeSession({ id: 's1', updatedAt: todayIso })]
  const groups = groupSessions(sessions, 'date', new Set())
  assert.equal(groups[0]?.[0], 'today')
  assert.equal(groups[0]?.[1]?.[0]?.id, 's1')
})

// ── groupSessions — project grouping ─────────────────────────────────────────

test('groupSessions project: groups sessions by projectLabel', () => {
  const sessions = [
    makeSession({ id: 'a1', projectLabel: 'alpha' }),
    makeSession({ id: 'b1', projectLabel: 'beta' }),
    makeSession({ id: 'a2', projectLabel: 'alpha' }),
  ]
  const groups = groupSessions(sessions, 'project', new Set())
  const alphaGroup = groups.find(([label]) => label === 'alpha')
  const betaGroup = groups.find(([label]) => label === 'beta')

  assert.ok(alphaGroup, 'alpha group should exist')
  assert.ok(betaGroup, 'beta group should exist')
  assert.equal(alphaGroup?.[1]?.length, 2)
  assert.equal(betaGroup?.[1]?.length, 1)
})

test('groupSessions project: preserves insertion order of groups', () => {
  const sessions = [
    makeSession({ id: 'a', projectLabel: 'first' }),
    makeSession({ id: 'b', projectLabel: 'second' }),
    makeSession({ id: 'c', projectLabel: 'first' }),
  ]
  const groups = groupSessions(sessions, 'project', new Set())
  assert.deepEqual(
    groups.map(([label]) => label),
    ['first', 'second'],
  )
})

// ── pinned sessions float to the top ─────────────────────────────────────────

test('groupSessions project: pinned sessions float to top within group', () => {
  const sessions = [
    makeSession({ id: 'a', projectLabel: 'proj' }),
    makeSession({ id: 'b', projectLabel: 'proj' }),
    makeSession({ id: 'c', projectLabel: 'proj' }),
  ]
  // Pin 'c' — it was last but should become first
  const pinned = new Set(['c'])
  const groups = groupSessions(sessions, 'project', pinned)
  const items = groups[0]?.[1] ?? []
  assert.equal(items[0]?.id, 'c')
  // 'a' and 'b' retain their relative order after 'c'
  assert.deepEqual(
    items.slice(1).map((s) => s.id),
    ['a', 'b'],
  )
})

test('groupSessions date: pinned sessions float to top within bucket', () => {
  const todayIso = new Date().toISOString()
  const sessions = [
    makeSession({ id: 'x', updatedAt: todayIso }),
    makeSession({ id: 'y', updatedAt: todayIso }),
    makeSession({ id: 'z', updatedAt: todayIso }),
  ]
  const pinned = new Set(['z'])
  const groups = groupSessions(sessions, 'date', pinned)
  const todayItems = groups.find(([key]) => key === 'today')?.[1] ?? []
  assert.equal(todayItems[0]?.id, 'z')
})

test('groupSessions: no pinned sessions leaves order unchanged', () => {
  const sessions = [
    makeSession({ id: 'a', projectLabel: 'p' }),
    makeSession({ id: 'b', projectLabel: 'p' }),
  ]
  const groups = groupSessions(sessions, 'project', new Set())
  const items = groups[0]?.[1] ?? []
  assert.deepEqual(
    items.map((s) => s.id),
    ['a', 'b'],
  )
})

test('groupSessions: multiple pinned sessions preserve their relative order', () => {
  const sessions = [
    makeSession({ id: 'a', projectLabel: 'p' }),
    makeSession({ id: 'b', projectLabel: 'p' }),
    makeSession({ id: 'c', projectLabel: 'p' }),
    makeSession({ id: 'd', projectLabel: 'p' }),
  ]
  // Pin 'b' and 'd' — they were 2nd and 4th
  const pinned = new Set(['b', 'd'])
  const groups = groupSessions(sessions, 'project', pinned)
  const items = groups[0]?.[1] ?? []
  assert.deepEqual(
    items.map((s) => s.id),
    ['b', 'd', 'a', 'c'],
  )
})
