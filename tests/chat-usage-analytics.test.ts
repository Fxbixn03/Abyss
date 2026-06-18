/**
 * Tests for `computeUsageAnalytics` in `core/chat/usage.ts`.
 *
 * Strategy: register lightweight stub `ChatRuntime` instances (same pattern as
 * `chat-usage-cache.test.ts`) that return controlled `ChatSessionMeta` objects.
 * Real temporary files are created so that `fs.stat` inside the caching layer
 * returns genuine mtime values — no mocking of Node built-ins.
 *
 * Covers:
 *  1. `days` clamping to `[7, 365]`
 *  2. `sinceDay` UTC cutoff — sessions outside the window must not appear in `daily`
 *  3. Per-agent rollup (`byAgent` sorted descending by total tokens)
 *  4. Per-project accumulation including `cwd`-keyed deduplication
 *  5. Multi-agent aggregation (two registered stubs, one session each)
 *  6. `cwd` filter that excludes out-of-tree sessions
 *  7. `lastActivityAt` reflects the most-recent `updatedAt` across all agents
 *  8. Empty-result fast-path when no runtimes have sessions
 */

import { test, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import os from 'node:os'
import path from 'node:path'
import { promises as fs } from 'node:fs'

import type { ChatRuntime, ChatUsageSource, ChatSessionFileRef } from '@core/chat/runtime'
import type { OsEnv } from '@/shared/types/agent'
import type { ChatSessionMeta } from '@/shared/types/chat'
import {
  registerChatRuntime,
  unregisterChatRuntime,
} from '@core/chat/registry'
import {
  computeUsageAnalytics,
  invalidateUsageCache,
} from '@core/chat/usage'

// ── helpers ───────────────────────────────────────────────────────────────────

const TEST_ENV: OsEnv = {
  home: os.homedir(),
  appData: os.homedir(),
  platform: process.platform === 'win32' ? 'win32' : 'linux',
}

const TEST_AGENT_A = 'test-analytics-agent-a'
const TEST_AGENT_B = 'test-analytics-agent-b'

let tmpDir = ''

async function setup(): Promise<string> {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'abyss-analytics-test-'))
  return tmpDir
}

async function teardown(): Promise<void> {
  if (tmpDir) {
    await fs.rm(tmpDir, { recursive: true, force: true })
    tmpDir = ''
  }
}

/** Write an empty file and return its path. */
async function touch(dir: string, name: string): Promise<string> {
  const p = path.join(dir, name)
  await fs.writeFile(p, '')
  return p
}

/** Build a minimal `ChatSessionMeta` for a given file path. */
function makeMeta(
  filePath: string,
  overrides: Partial<ChatSessionMeta> = {},
): ChatSessionMeta {
  return {
    id: path.basename(filePath, '.jsonl'),
    agentId: TEST_AGENT_A,
    title: path.basename(filePath),
    cwd: '/tmp/project',
    projectLabel: 'project',
    messageCount: 1,
    sizeBytes: 0,
    filePath,
    updatedAt: '2024-06-01T00:00:00Z',
    inputTokens: 100,
    outputTokens: 50,
    ...overrides,
  }
}

/** Build a minimal stub `ChatRuntime` with a controlled `usage` source. */
function makeRuntime(
  agentId: string,
  files: ChatSessionFileRef[],
  readMetaImpl: (ref: ChatSessionFileRef) => Promise<ChatSessionMeta | null>,
  includeUsage = true,
): ChatRuntime {
  const usage: ChatUsageSource | undefined = includeUsage
    ? {
        listFiles: () => Promise.resolve(files),
        readMeta: readMetaImpl,
      }
    : undefined

  return {
    agentId,
    usage,
    listSessions: () => { throw new Error('not implemented') },
    readSession: () => { throw new Error('not implemented') },
    deleteSession: () => { throw new Error('not implemented') },
    availability: () => { throw new Error('not implemented') },
    login: () => { throw new Error('not implemented') },
    logout: () => { throw new Error('not implemented') },
    start: () => { throw new Error('not implemented') },
  }
}

/** Return a YYYY-MM-DD string for today minus `n` days (UTC). */
function utcDayOffset(n: number): string {
  const d = new Date()
  d.setUTCDate(d.getUTCDate() - n)
  return d.toISOString().slice(0, 10)
}

// Cleanup after each test: evict the cache and remove test agent registrations.
afterEach(async () => {
  invalidateUsageCache()
  unregisterChatRuntime(TEST_AGENT_A)
  unregisterChatRuntime(TEST_AGENT_B)
  await teardown()
})

// ── 1: days clamping ──────────────────────────────────────────────────────────

test('days clamping: value below 7 is clamped to 7', async () => {
  const dir = await setup()
  const filePath = await touch(dir, 'session.jsonl')

  const runtime = makeRuntime(TEST_AGENT_A, [{ filePath }], async () =>
    makeMeta(filePath),
  )
  registerChatRuntime(runtime)

  const result = await computeUsageAnalytics(TEST_ENV, [TEST_AGENT_A], { days: 1 })
  assert.equal(result.days, 7, 'days below 7 must be clamped to 7')
  assert.equal(result.daily.length, 7, 'daily array must have 7 entries when clamped')
})

test('days clamping: value above 365 is clamped to 365', async () => {
  const dir = await setup()
  const filePath = await touch(dir, 'session.jsonl')

  const runtime = makeRuntime(TEST_AGENT_A, [{ filePath }], async () =>
    makeMeta(filePath),
  )
  registerChatRuntime(runtime)

  const result = await computeUsageAnalytics(TEST_ENV, [TEST_AGENT_A], { days: 9999 })
  assert.equal(result.days, 365, 'days above 365 must be clamped to 365')
  assert.equal(result.daily.length, 365, 'daily array must have 365 entries when clamped')
})

test('days clamping: value within [7, 365] is preserved exactly', async () => {
  const dir = await setup()
  const filePath = await touch(dir, 'session.jsonl')

  const runtime = makeRuntime(TEST_AGENT_A, [{ filePath }], async () =>
    makeMeta(filePath),
  )
  registerChatRuntime(runtime)

  const result = await computeUsageAnalytics(TEST_ENV, [TEST_AGENT_A], { days: 90 })
  assert.equal(result.days, 90, 'days within range must be returned unchanged')
  assert.equal(result.daily.length, 90, 'daily array length must match days')
})

// ── 2: sinceDay UTC cutoff ─────────────────────────────────────────────────────

test('sinceDay cutoff: session within the window appears in daily tokens', async () => {
  const dir = await setup()
  const filePath = await touch(dir, 'recent.jsonl')

  // Use today's date as the session timestamp so it's inside any window >= 7
  const today = utcDayOffset(0)
  const runtime = makeRuntime(TEST_AGENT_A, [{ filePath }], async () =>
    makeMeta(filePath, {
      updatedAt: `${today}T10:00:00Z`,
      inputTokens: 200,
      outputTokens: 100,
    }),
  )
  registerChatRuntime(runtime)

  const result = await computeUsageAnalytics(TEST_ENV, [TEST_AGENT_A], { days: 7 })
  const todayEntry = result.daily.find((d) => d.date === today)
  assert.ok(todayEntry, 'today must appear in daily')
  assert.equal(todayEntry?.tokens, 300, 'tokens for today must be 300')
})

test('sinceDay cutoff: session outside the window does not appear in daily tokens', async () => {
  const dir = await setup()
  const filePath = await touch(dir, 'old.jsonl')

  // Use a date that is guaranteed to be before the 7-day window
  const oldDate = '2000-01-01'
  const runtime = makeRuntime(TEST_AGENT_A, [{ filePath }], async () =>
    makeMeta(filePath, {
      updatedAt: `${oldDate}T10:00:00Z`,
      inputTokens: 500,
      outputTokens: 250,
    }),
  )
  registerChatRuntime(runtime)

  const result = await computeUsageAnalytics(TEST_ENV, [TEST_AGENT_A], { days: 7 })
  // The old session should still count towards totals
  assert.equal(result.totalSessions, 1)
  assert.equal(result.inputTokens, 500)
  // But it must NOT appear in any daily bucket
  const totalDailyTokens = result.daily.reduce((s, d) => s + d.tokens, 0)
  assert.equal(totalDailyTokens, 0, 'out-of-window session must not add to daily tokens')
})

// ── 3: per-agent rollup sorted by tokens ──────────────────────────────────────

test('byAgent: sorted descending by total tokens (inputTokens + outputTokens)', async () => {
  const dir = await setup()
  const fileA = await touch(dir, 'agent-a.jsonl')
  const fileB = await touch(dir, 'agent-b.jsonl')

  // Agent A has fewer tokens than Agent B
  const runtimeA = makeRuntime(TEST_AGENT_A, [{ filePath: fileA }], async () =>
    makeMeta(fileA, { agentId: TEST_AGENT_A, inputTokens: 100, outputTokens: 50 }),
  )
  const runtimeB = makeRuntime(TEST_AGENT_B, [{ filePath: fileB }], async () =>
    makeMeta(fileB, { agentId: TEST_AGENT_B, inputTokens: 500, outputTokens: 300 }),
  )
  registerChatRuntime(runtimeA)
  registerChatRuntime(runtimeB)

  const result = await computeUsageAnalytics(TEST_ENV, [TEST_AGENT_A, TEST_AGENT_B])
  assert.equal(result.byAgent.length, 2)
  // B should be first (higher total tokens)
  assert.equal(result.byAgent[0].agentId, TEST_AGENT_B, 'agent with more tokens must be first')
  assert.equal(result.byAgent[1].agentId, TEST_AGENT_A, 'agent with fewer tokens must be second')
  // Verify correct per-agent totals
  assert.equal(result.byAgent[0].inputTokens, 500)
  assert.equal(result.byAgent[0].outputTokens, 300)
  assert.equal(result.byAgent[1].inputTokens, 100)
  assert.equal(result.byAgent[1].outputTokens, 50)
})

test('byAgent: single agent with one session populates byAgent correctly', async () => {
  const dir = await setup()
  const filePath = await touch(dir, 'single.jsonl')

  const runtime = makeRuntime(TEST_AGENT_A, [{ filePath }], async () =>
    makeMeta(filePath, { agentId: TEST_AGENT_A, inputTokens: 300, outputTokens: 150 }),
  )
  registerChatRuntime(runtime)

  const result = await computeUsageAnalytics(TEST_ENV, [TEST_AGENT_A])
  assert.equal(result.byAgent.length, 1)
  assert.equal(result.byAgent[0].agentId, TEST_AGENT_A)
  assert.equal(result.byAgent[0].sessions, 1)
  assert.equal(result.byAgent[0].inputTokens, 300)
  assert.equal(result.byAgent[0].outputTokens, 150)
})

// ── 4: per-project accumulation with cwd-keyed deduplication ─────────────────

test('per-project: sessions with same cwd are merged into one project entry', async () => {
  const dir = await setup()
  const fileA = await touch(dir, 'proj-a1.jsonl')
  const fileB = await touch(dir, 'proj-a2.jsonl')

  const refs: ChatSessionFileRef[] = [{ filePath: fileA }, { filePath: fileB }]
  const runtime = makeRuntime(TEST_AGENT_A, refs, async (ref) =>
    makeMeta(ref.filePath, {
      cwd: '/home/user/myproject',
      projectLabel: 'myproject',
      inputTokens: 100,
      outputTokens: 50,
    }),
  )
  registerChatRuntime(runtime)

  const result = await computeUsageAnalytics(TEST_ENV, [TEST_AGENT_A])
  // Both sessions share the same cwd → exactly one project entry
  assert.equal(result.projects.length, 1, 'same-cwd sessions must be merged')
  assert.equal(result.projects[0].cwd, '/home/user/myproject')
  assert.equal(result.projects[0].sessions, 2, 'merged project must report 2 sessions')
  assert.equal(result.projects[0].inputTokens, 200, 'input tokens must be summed')
  assert.equal(result.projects[0].outputTokens, 100, 'output tokens must be summed')
})

test('per-project: sessions with different cwd produce separate project entries', async () => {
  const dir = await setup()
  const fileA = await touch(dir, 'proj-b1.jsonl')
  const fileB = await touch(dir, 'proj-b2.jsonl')

  const refs: ChatSessionFileRef[] = [{ filePath: fileA }, { filePath: fileB }]
  const runtime = makeRuntime(TEST_AGENT_A, refs, async (ref) => {
    const isA = ref.filePath === fileA
    return makeMeta(ref.filePath, {
      cwd: isA ? '/home/user/alpha' : '/home/user/beta',
      projectLabel: isA ? 'alpha' : 'beta',
    })
  })
  registerChatRuntime(runtime)

  const result = await computeUsageAnalytics(TEST_ENV, [TEST_AGENT_A])
  assert.equal(result.projects.length, 2, 'different-cwd sessions must be separate projects')
  const cwds = result.projects.map((p) => p.cwd).sort()
  assert.deepEqual(cwds, ['/home/user/alpha', '/home/user/beta'])
})

// ── 5: multi-agent aggregation ────────────────────────────────────────────────

test('multi-agent: totals are correctly summed across two registered runtimes', async () => {
  const dir = await setup()
  const fileA = await touch(dir, 'ma-a.jsonl')
  const fileB = await touch(dir, 'ma-b.jsonl')

  const runtimeA = makeRuntime(TEST_AGENT_A, [{ filePath: fileA }], async () =>
    makeMeta(fileA, { agentId: TEST_AGENT_A, inputTokens: 100, outputTokens: 40, messageCount: 5 }),
  )
  const runtimeB = makeRuntime(TEST_AGENT_B, [{ filePath: fileB }], async () =>
    makeMeta(fileB, { agentId: TEST_AGENT_B, inputTokens: 200, outputTokens: 80, messageCount: 3 }),
  )
  registerChatRuntime(runtimeA)
  registerChatRuntime(runtimeB)

  const result = await computeUsageAnalytics(TEST_ENV, [TEST_AGENT_A, TEST_AGENT_B])
  assert.equal(result.totalSessions, 2)
  assert.equal(result.totalMessages, 8, 'totalMessages must be summed (5 + 3)')
  assert.equal(result.inputTokens, 300, 'inputTokens must be summed (100 + 200)')
  assert.equal(result.outputTokens, 120, 'outputTokens must be summed (40 + 80)')
  assert.equal(result.byAgent.length, 2)
})

// ── 6: cwd filter excludes out-of-tree sessions ───────────────────────────────

test('cwd filter: sessions outside the requested cwd are excluded from all rollups', async () => {
  const dir = await setup()
  const fileIn = await touch(dir, 'cwd-in.jsonl')
  const fileOut = await touch(dir, 'cwd-out.jsonl')

  const refs: ChatSessionFileRef[] = [{ filePath: fileIn }, { filePath: fileOut }]
  const runtime = makeRuntime(TEST_AGENT_A, refs, async (ref) => {
    const isIn = ref.filePath === fileIn
    return makeMeta(ref.filePath, {
      cwd: isIn ? '/home/user/target' : '/home/user/other',
      projectLabel: isIn ? 'target' : 'other',
      inputTokens: 100,
      outputTokens: 50,
    })
  })
  registerChatRuntime(runtime)

  const result = await computeUsageAnalytics(TEST_ENV, [TEST_AGENT_A], {
    cwd: '/home/user/target',
  })
  assert.equal(result.totalSessions, 1, 'only in-tree session must be counted')
  assert.equal(result.inputTokens, 100, 'only in-tree tokens must be summed')
  // Project list must only contain the in-tree project
  assert.equal(result.projects.length, 1)
  assert.equal(result.projects[0].cwd, '/home/user/target')
})

test('cwd filter: nested sub-directory sessions are included', async () => {
  const dir = await setup()
  const fileNested = await touch(dir, 'nested.jsonl')
  const fileOut = await touch(dir, 'outside.jsonl')

  const refs: ChatSessionFileRef[] = [{ filePath: fileNested }, { filePath: fileOut }]
  const runtime = makeRuntime(TEST_AGENT_A, refs, async (ref) => {
    const isNested = ref.filePath === fileNested
    return makeMeta(ref.filePath, {
      cwd: isNested ? '/home/user/target/sub/deep' : '/home/user/unrelated',
      projectLabel: isNested ? 'deep' : 'unrelated',
    })
  })
  registerChatRuntime(runtime)

  const result = await computeUsageAnalytics(TEST_ENV, [TEST_AGENT_A], {
    cwd: '/home/user/target',
  })
  assert.equal(result.totalSessions, 1, 'nested session must be included by cwd filter')
})

// ── 7: lastActivityAt across agents ──────────────────────────────────────────

test('lastActivityAt: reflects the most-recent updatedAt across all agents', async () => {
  const dir = await setup()
  const fileA = await touch(dir, 'la-a.jsonl')
  const fileB = await touch(dir, 'la-b.jsonl')

  const runtimeA = makeRuntime(TEST_AGENT_A, [{ filePath: fileA }], async () =>
    makeMeta(fileA, { updatedAt: '2024-06-10T08:00:00Z' }),
  )
  const runtimeB = makeRuntime(TEST_AGENT_B, [{ filePath: fileB }], async () =>
    makeMeta(fileB, { updatedAt: '2024-06-15T12:00:00Z' }),
  )
  registerChatRuntime(runtimeA)
  registerChatRuntime(runtimeB)

  const result = await computeUsageAnalytics(TEST_ENV, [TEST_AGENT_A, TEST_AGENT_B])
  // Agent B's session is more recent
  assert.equal(
    result.lastActivityAt,
    '2024-06-15T12:00:00Z',
    'lastActivityAt must be the most recent updatedAt',
  )
})

test('lastActivityAt: when only one agent has sessions, reflects that agent\'s updatedAt', async () => {
  const dir = await setup()
  const fileA = await touch(dir, 'la-only-a.jsonl')

  const runtimeA = makeRuntime(TEST_AGENT_A, [{ filePath: fileA }], async () =>
    makeMeta(fileA, { updatedAt: '2024-03-20T09:00:00Z' }),
  )
  // Agent B has no sessions
  const runtimeB = makeRuntime(TEST_AGENT_B, [], async () => null)
  registerChatRuntime(runtimeA)
  registerChatRuntime(runtimeB)

  const result = await computeUsageAnalytics(TEST_ENV, [TEST_AGENT_A, TEST_AGENT_B])
  assert.equal(result.lastActivityAt, '2024-03-20T09:00:00Z')
})

// ── 8: empty-result fast-path ─────────────────────────────────────────────────

test('empty fast-path: no runtimes registered returns zero totals', async () => {
  // No runtimes registered at all — both agent IDs are unknown
  const result = await computeUsageAnalytics(TEST_ENV, [TEST_AGENT_A, TEST_AGENT_B])
  assert.equal(result.totalSessions, 0)
  assert.equal(result.totalMessages, 0)
  assert.equal(result.inputTokens, 0)
  assert.equal(result.outputTokens, 0)
  assert.equal(result.byAgent.length, 0)
  assert.equal(result.projects.length, 0)
  assert.equal(result.lastActivityAt, undefined)
})

test('empty fast-path: runtimes registered but all return empty session lists', async () => {
  // Runtimes exist but have no files to list
  const runtimeA = makeRuntime(TEST_AGENT_A, [], async () => null)
  const runtimeB = makeRuntime(TEST_AGENT_B, [], async () => null)
  registerChatRuntime(runtimeA)
  registerChatRuntime(runtimeB)

  const result = await computeUsageAnalytics(TEST_ENV, [TEST_AGENT_A, TEST_AGENT_B])
  assert.equal(result.totalSessions, 0)
  assert.equal(result.byAgent.length, 0, 'byAgent must be empty when no sessions exist')
  assert.equal(result.lastActivityAt, undefined)
})

test('empty fast-path: runtime without a usage source returns empty without throwing', async () => {
  const runtimeA = makeRuntime(
    TEST_AGENT_A,
    [],
    async () => null,
    false, // includeUsage = false
  )
  registerChatRuntime(runtimeA)

  const result = await computeUsageAnalytics(TEST_ENV, [TEST_AGENT_A])
  assert.equal(result.totalSessions, 0)
  assert.equal(result.byAgent.length, 0)
})

// ── bonus: daily array structure ──────────────────────────────────────────────

test('daily: array is oldest-first and covers exactly `days` calendar days', async () => {
  const dir = await setup()
  const filePath = await touch(dir, 'daily-structure.jsonl')

  const runtime = makeRuntime(TEST_AGENT_A, [{ filePath }], async () =>
    makeMeta(filePath),
  )
  registerChatRuntime(runtime)

  const result = await computeUsageAnalytics(TEST_ENV, [TEST_AGENT_A], { days: 14 })
  assert.equal(result.daily.length, 14, 'daily must have exactly 14 entries')

  // Verify oldest-first order
  for (let i = 1; i < result.daily.length; i++) {
    assert.ok(
      result.daily[i].date >= result.daily[i - 1].date,
      'daily entries must be in ascending (oldest-first) date order',
    )
  }

  // Last entry should be today
  const today = utcDayOffset(0)
  assert.equal(result.daily[result.daily.length - 1].date, today, 'last daily entry must be today')
})
