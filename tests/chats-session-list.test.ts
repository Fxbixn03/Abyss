/**
 * Unit tests for the pure sort/group helpers in
 * src/features/chats/lib/session-list.ts (node:test).
 * No React, no IPC, no DOM — fully deterministic.
 */

import { test } from 'node:test'
import assert from 'node:assert/strict'

import {
  filterSessions,
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

test('dateBucket: Date object input is accepted', () => {
  // A Date object from now must return 'today'
  assert.equal(dateBucket(new Date()), 'today')
})

test('dateBucket: numeric Unix timestamp is accepted', () => {
  // A numeric ms-since-epoch from now must return 'today'
  assert.equal(dateBucket(Date.now()), 'today')
})

test('dateBucket: numeric timestamp 45 days ago returns "older"', () => {
  const ms = Date.now() - 45 * 24 * 60 * 60 * 1000
  assert.equal(dateBucket(ms), 'older')
})

test('dateBucket: Sunday Monday-week boundary — startOfWeek goes back 6 days on Sundays', () => {
  const now = new Date()
  const dayOfWeek = now.getDay() // 0=Sun … 6=Sat

  if (dayOfWeek === 0) {
    // Today is Sunday. startOfWeek is last Monday (6 days ago).
    // A timestamp from Tuesday of this week (5 days ago, noon) must be 'thisWeek'.
    const tuesday = new Date(now)
    tuesday.setDate(tuesday.getDate() - 5)
    tuesday.setHours(12, 0, 0, 0)
    assert.equal(
      dateBucket(tuesday),
      'thisWeek',
      'Tuesday of this week should be thisWeek when today is Sunday',
    )

    // The Sunday immediately preceding last Monday (8 days ago, 23:59) is
    // before startOfWeek and therefore NOT 'thisWeek'.
    const prevSunday = new Date(now)
    prevSunday.setDate(prevSunday.getDate() - 8)
    prevSunday.setHours(23, 59, 59, 999)
    const prevSundayBucket = dateBucket(prevSunday)
    assert.notEqual(
      prevSundayBucket,
      'thisWeek',
      'Sunday before last Monday must not be thisWeek',
    )
    assert.notEqual(prevSundayBucket, 'today')
    assert.notEqual(prevSundayBucket, 'yesterday')
  } else {
    // For any other day: verify the Monday-anchored start-of-week is correct.
    // The Monday of the current week (daysToMonday days ago) at noon must be
    // 'thisWeek' unless it is today (Monday itself → check 'today' or
    // 'thisWeek') or yesterday (Tuesday → 'yesterday' possible after Monday).
    const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1
    if (daysToMonday >= 2) {
      // Monday was at least 2 days ago; it must be in thisWeek
      const monday = new Date(now)
      monday.setDate(monday.getDate() - daysToMonday)
      monday.setHours(12, 0, 0, 0)
      assert.equal(
        dateBucket(monday),
        'thisWeek',
        `Monday of this week should be thisWeek (daysToMonday=${daysToMonday})`,
      )
    }
  }
})

test('dateBucket: Sunday 23:59 of current week is thisWeek when today is Sunday', () => {
  const now = new Date()
  const dayOfWeek = now.getDay()

  if (dayOfWeek !== 0) {
    // Not Sunday — skip the Sunday-specific assertion but ensure the test is
    // counted as a pass (the path-under-test only fires on Sundays).
    return
  }

  // Today is Sunday. startOfWeek = last Monday. Yesterday = last Saturday.
  // A Sunday-at-23:59 that falls WITHIN the current week (i.e. today itself,
  // but before the current moment) must return 'today', not 'thisWeek'.
  // More importantly: Saturday at 23:59 (yesterday) must be 'yesterday', and
  // Monday noon (6 days ago) must be 'thisWeek' — proving the 6-day rollback.
  const saturdayAt2359 = new Date(now)
  saturdayAt2359.setDate(saturdayAt2359.getDate() - 1)
  saturdayAt2359.setHours(23, 59, 0, 0)
  assert.equal(
    dateBucket(saturdayAt2359),
    'yesterday',
    'Saturday at 23:59 should be yesterday when today is Sunday',
  )

  const mondayNoon = new Date(now)
  mondayNoon.setDate(mondayNoon.getDate() - 6)
  mondayNoon.setHours(12, 0, 0, 0)
  assert.equal(
    dateBucket(mondayNoon),
    'thisWeek',
    'Monday noon should be thisWeek when today is Sunday (daysToMonday=6)',
  )
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

test('groupSessions: empty pinnedIds set returns groups in DATE_BUCKET_KEY_ORDER and omits empty buckets', () => {
  const now = new Date()

  // Build one session for 'today' and one for 'older'; leave all other buckets empty.
  const oldTs = new Date(Date.now() - 45 * 24 * 60 * 60 * 1000).toISOString()
  const todayTs = now.toISOString()

  const sessions = [
    makeSession({ id: 'today1', updatedAt: todayTs }),
    makeSession({ id: 'old1', updatedAt: oldTs }),
  ]

  const groups = groupSessions(sessions, 'date', new Set())

  // Only the two non-empty buckets must appear
  assert.equal(groups.length, 2, 'exactly two non-empty buckets expected')

  const keys = groups.map(([k]) => k)
  assert.ok(keys.includes('today'), 'today bucket must be present')
  assert.ok(keys.includes('older'), 'older bucket must be present')

  // Keys must appear in DATE_BUCKET_KEY_ORDER
  const positions = keys.map((k) => DATE_BUCKET_KEY_ORDER.indexOf(k))
  for (let i = 1; i < positions.length; i++) {
    assert.ok(
      (positions[i] ?? 0) > (positions[i - 1] ?? 0),
      `Buckets out of order: ${keys.join(', ')}`,
    )
  }

  // Intermediate buckets must not appear
  const presentKeys = new Set(keys)
  for (const k of DATE_BUCKET_KEY_ORDER) {
    if (k !== 'today' && k !== 'older') {
      assert.ok(!presentKeys.has(k), `Unexpected empty bucket: ${k}`)
    }
  }
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

// ── filterSessions ────────────────────────────────────────────────────────────

test('filterSessions: empty query returns all sessions unchanged (same reference)', () => {
  const sessions = [
    makeSession({ id: 'a', title: 'Alpha' }),
    makeSession({ id: 'b', title: 'Beta' }),
  ]
  assert.strictEqual(filterSessions(sessions, ''), sessions)
})

test('filterSessions: whitespace-only query returns all sessions unchanged (same reference)', () => {
  const sessions = [makeSession({ id: 'a' })]
  assert.strictEqual(filterSessions(sessions, '   '), sessions)
})

test('filterSessions: matches by title (case-insensitive)', () => {
  const sessions = [
    makeSession({ id: 'a', title: 'Refactor database layer' }),
    makeSession({ id: 'b', title: 'Add login page' }),
    makeSession({ id: 'c', title: 'Fix REFACTOR typo' }),
  ]
  const result = filterSessions(sessions, 'REFACTOR')
  assert.deepEqual(
    result.map((s) => s.id),
    ['a', 'c'],
  )
})

test('filterSessions: matches by projectLabel (case-insensitive)', () => {
  const sessions = [
    makeSession({ id: 'a', projectLabel: 'MyProject' }),
    makeSession({ id: 'b', projectLabel: 'other' }),
    makeSession({ id: 'c', projectLabel: 'myproject-v2' }),
  ]
  const result = filterSessions(sessions, 'myproject')
  assert.deepEqual(
    result.map((s) => s.id),
    ['a', 'c'],
  )
})

test('filterSessions: matches by cwd (case-insensitive)', () => {
  const sessions = [
    makeSession({ id: 'a', cwd: '/home/user/src/backend' }),
    makeSession({ id: 'b', cwd: '/home/user/src/frontend' }),
    makeSession({ id: 'c', cwd: '/tmp/scratch' }),
  ]
  const result = filterSessions(sessions, 'Backend')
  assert.deepEqual(
    result.map((s) => s.id),
    ['a'],
  )
})

test('filterSessions: non-matching query returns empty array', () => {
  const sessions = [
    makeSession({ id: 'a', title: 'Alpha', projectLabel: 'proj', cwd: '/home/user/proj' }),
    makeSession({ id: 'b', title: 'Beta', projectLabel: 'proj', cwd: '/home/user/proj' }),
  ]
  const result = filterSessions(sessions, 'zzznomatch')
  assert.equal(result.length, 0)
})

test('filterSessions: returns empty array when sessions list is empty', () => {
  const result = filterSessions([], 'anything')
  assert.equal(result.length, 0)
})

test('filterSessions: query matches any of title, projectLabel, or cwd independently', () => {
  const needle = 'needle'
  const sessions = [
    makeSession({ id: 'title-match', title: `has needle here`, projectLabel: 'proj', cwd: '/cwd' }),
    makeSession({ id: 'label-match', title: 'unrelated', projectLabel: `needle-project`, cwd: '/cwd' }),
    makeSession({ id: 'cwd-match', title: 'unrelated', projectLabel: 'proj', cwd: `/home/needle/src` }),
    makeSession({ id: 'no-match', title: 'unrelated', projectLabel: 'proj', cwd: '/cwd' }),
  ]
  const result = filterSessions(sessions, needle)
  assert.deepEqual(
    result.map((s) => s.id),
    ['title-match', 'label-match', 'cwd-match'],
  )
})

test('filterSessions: trims leading/trailing whitespace from query before matching', () => {
  const sessions = [
    makeSession({ id: 'a', title: 'hello world' }),
    makeSession({ id: 'b', title: 'something else' }),
  ]
  const result = filterSessions(sessions, '  hello  ')
  assert.deepEqual(
    result.map((s) => s.id),
    ['a'],
  )
})
