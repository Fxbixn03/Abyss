/**
 * Tests for the async aggregation layer in `core/chat/insights.ts`.
 *
 * The pure inner helpers (`looksLikeCorrection`, `frictionForTranscript`) are
 * already tested in `chat-insights.test.ts`. This file targets `computeInsights`
 * — the function that calls the runtime, applies mtime caching, and builds the
 * `InsightsReport` aggregate.
 *
 * Strategy: inject a lightweight stub `ChatRuntime` via `registerChatRuntime` /
 * `unregisterChatRuntime`. Real temporary files are written to disk so that
 * `fs.stat` inside `frictionForSession` returns genuine mtime values (the same
 * pattern used by `chat-usage-cache.test.ts`).
 *
 * Covers:
 *  1.  Empty report when no runtime is registered for the agent.
 *  2.  Single session with known friction signals → correct avgScore, corrections,
 *      toolErrors, buckets.
 *  3.  topFriction contains the highest-scoring sessions (capped at 8).
 *  4.  daily array groups scores by updatedAt date, averaging when multiple
 *      sessions share a day.
 *  5.  mtime cache hit: second call with same mtime does NOT call readSession again.
 *  6.  mtime cache miss: after file mtime changes, readSession IS called again.
 *  7.  cwd filter excludes sessions from other directories.
 *  8.  Session where readSession throws is silently skipped.
 */

import { test, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import os from 'node:os'
import path from 'node:path'
import { promises as fs } from 'node:fs'

import type { ChatRuntime, LiveSession, StartContext } from '@core/chat/runtime'
import type { OsEnv } from '@/shared/types/agent'
import type {
  ChatSessionMeta,
  ChatSessionPage,
  ChatTranscript,
  ChatMessage,
  ChatAvailability,
} from '@/shared/types/chat'
import {
  registerChatRuntime,
  unregisterChatRuntime,
} from '@core/chat/registry'
import {
  computeInsights,
  invalidateInsightsCache,
} from '@core/chat/insights'

// ── constants ─────────────────────────────────────────────────────────────────

const TEST_AGENT = 'test-insights-agent'

const TEST_ENV: OsEnv = {
  home: os.homedir(),
  appData: os.homedir(),
  platform: process.platform === 'win32' ? 'win32' : 'linux',
}

// ── helpers ───────────────────────────────────────────────────────────────────

let tmpDir = ''

async function setup(): Promise<string> {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'abyss-insights-test-'))
  return tmpDir
}

async function teardown(): Promise<void> {
  if (tmpDir) {
    await fs.rm(tmpDir, { recursive: true, force: true })
    tmpDir = ''
  }
}

/** Write a minimal file to disk (so fs.stat works) and return its path. */
async function touch(dir: string, name: string): Promise<string> {
  const p = path.join(dir, name)
  await fs.writeFile(p, '')
  return p
}

/** Build a minimal `ChatSessionMeta`. */
function makeMeta(
  filePath: string,
  overrides: Partial<ChatSessionMeta> = {},
): ChatSessionMeta {
  return {
    id: path.basename(filePath, '.jsonl'),
    agentId: 'claude',
    title: path.basename(filePath),
    cwd: '/tmp/project',
    projectLabel: 'project',
    messageCount: 1,
    sizeBytes: 0,
    filePath,
    updatedAt: '2024-06-01T00:00:00Z',
    ...overrides,
  }
}

/** Build a user message that looks like a correction. */
function correctionMessage(): ChatMessage {
  return {
    id: 'msg-corr',
    role: 'user',
    blocks: [{ kind: 'text', text: 'no, that is wrong' }],
  }
}

/** Build a tool_result block with isError: true. */
function toolErrorMessage(): ChatMessage {
  return {
    id: 'msg-err',
    role: 'user',
    blocks: [
      {
        kind: 'tool_result',
        toolUseId: 'tu-1',
        output: 'command not found',
        isError: true,
      },
    ],
  }
}

/** Build a minimal transcript with the supplied messages. */
function makeTranscript(
  meta: ChatSessionMeta,
  messages: ChatMessage[],
): ChatTranscript {
  return { ...meta, messages }
}

/**
 * Build a stub `ChatRuntime` whose `listSessions` returns `metas` and whose
 * `readSession` is provided by the caller so tests can swap or spy on it.
 */
function makeRuntime(
  metas: ChatSessionMeta[],
  readSessionImpl: (env: OsEnv, sessionId: string) => Promise<ChatTranscript>,
): ChatRuntime {
  const notImplemented = (): never => {
    throw new Error('not implemented')
  }

  const stubLiveSession: LiveSession = {
    send: notImplemented,
    respondPermission: notImplemented,
    interrupt: notImplemented,
    dispose: notImplemented,
  }

  return {
    agentId: TEST_AGENT,
    listSessions: (_env: OsEnv): Promise<ChatSessionPage> =>
      Promise.resolve({ sessions: metas, total: metas.length }),
    readSession: readSessionImpl,
    deleteSession: notImplemented,
    availability: (_env: OsEnv): Promise<ChatAvailability> =>
      notImplemented(),
    login: (_env: OsEnv): Promise<ChatAvailability> => notImplemented(),
    logout: notImplemented,
    start: (_ctx: StartContext): Promise<LiveSession> =>
      Promise.resolve(stubLiveSession),
  }
}

// Cleanup after each test.
afterEach(async () => {
  invalidateInsightsCache()
  unregisterChatRuntime(TEST_AGENT)
  await teardown()
})

// ── 1: empty report when no runtime is registered ────────────────────────────

test('computeInsights: returns empty report when no runtime is registered', async () => {
  // TEST_AGENT is not registered — do NOT call registerChatRuntime here.
  const report = await computeInsights(TEST_ENV, 'completely-unknown-agent-xyz')
  assert.equal(report.sessionsAnalyzed, 0)
  assert.equal(report.avgScore, 0)
  assert.equal(report.totalToolErrors, 0)
  assert.equal(report.totalCorrections, 0)
  assert.equal(report.topFriction.length, 0)
  assert.equal(report.daily.length, 0)
  assert.deepEqual(report.buckets, { smooth: 0, some: 0, high: 0 })
})

// ── 2: single session with known friction signals ─────────────────────────────

test('computeInsights: single session produces correct avgScore, corrections, toolErrors, buckets', async () => {
  const dir = await setup()
  const filePath = await touch(dir, 'sess-a.jsonl')
  const meta = makeMeta(filePath, { updatedAt: '2024-06-01T12:00:00Z' })

  // 1 correction (14 pts) + 1 tool error (9 pts) = 23 → "some" bucket
  const messages: ChatMessage[] = [correctionMessage(), toolErrorMessage()]
  const runtime = makeRuntime([meta], (_env, _id) =>
    Promise.resolve(makeTranscript(meta, messages)),
  )
  registerChatRuntime(runtime)

  const report = await computeInsights(TEST_ENV, TEST_AGENT)
  assert.equal(report.sessionsAnalyzed, 1)
  assert.equal(report.totalCorrections, 1)
  assert.equal(report.totalToolErrors, 1)
  assert.equal(report.avgScore, 23)
  assert.deepEqual(report.buckets, { smooth: 0, some: 1, high: 0 })
})

// ── 3: topFriction is capped at 8 and ordered by score descending ─────────────

test('computeInsights: topFriction contains highest-scoring sessions capped at 8', async () => {
  const dir = await setup()

  // Create 10 sessions with distinct scores (via different correction counts).
  const metas: ChatSessionMeta[] = []
  const transcripts = new Map<string, ChatTranscript>()

  for (let i = 0; i < 10; i++) {
    const filePath = await touch(dir, `sess-top-${i}.jsonl`)
    const meta = makeMeta(filePath, {
      id: `sess-top-${i}`,
      updatedAt: '2024-06-01T12:00:00Z',
    })
    metas.push(meta)
    // Score = min(100, i * 14). Session 0 has score 0, session 7+ hits 100.
    const msgs: ChatMessage[] = Array.from({ length: i }, () =>
      correctionMessage(),
    )
    transcripts.set(meta.id, makeTranscript(meta, msgs))
  }

  const runtime = makeRuntime(metas, (_env, sessionId) => {
    const t = transcripts.get(sessionId)
    if (!t) throw new Error(`unknown session: ${sessionId}`)
    return Promise.resolve(t)
  })
  registerChatRuntime(runtime)

  const report = await computeInsights(TEST_ENV, TEST_AGENT)
  // topFriction should be capped at 8 and only include sessions with score > 0
  assert.ok(
    report.topFriction.length <= 8,
    `topFriction length ${report.topFriction.length} exceeds 8`,
  )
  // All returned entries must have score > 0
  for (const f of report.topFriction) {
    assert.ok(f.score > 0, `topFriction contains zero-score entry: ${f.sessionId}`)
  }
  // Must be ordered descending by score
  for (let i = 1; i < report.topFriction.length; i++) {
    assert.ok(
      report.topFriction[i - 1].score >= report.topFriction[i].score,
      'topFriction must be ordered by score descending',
    )
  }
})

// ── 4: daily array groups scores by updatedAt date, averaging per day ─────────

test('computeInsights: daily array groups scores by updatedAt date and averages them', async () => {
  const dir = await setup()

  // Session A and B share the same calendar date; C is on a different date.
  const fileA = await touch(dir, 'sess-day-a.jsonl')
  const fileB = await touch(dir, 'sess-day-b.jsonl')
  const fileC = await touch(dir, 'sess-day-c.jsonl')

  const metaA = makeMeta(fileA, {
    id: 'sess-day-a',
    updatedAt: '2024-06-01T08:00:00Z',
  })
  const metaB = makeMeta(fileB, {
    id: 'sess-day-b',
    updatedAt: '2024-06-01T20:00:00Z',
  })
  const metaC = makeMeta(fileC, {
    id: 'sess-day-c',
    updatedAt: '2024-06-02T10:00:00Z',
  })

  // A: 1 correction → score 14; B: 2 corrections → score 28; average = 21.
  // C: 1 tool error → score 9.
  const transcripts = new Map<string, ChatTranscript>([
    [
      'sess-day-a',
      makeTranscript(metaA, [correctionMessage()]),
    ],
    [
      'sess-day-b',
      makeTranscript(metaB, [correctionMessage(), correctionMessage()]),
    ],
    ['sess-day-c', makeTranscript(metaC, [toolErrorMessage()])],
  ])

  const runtime = makeRuntime([metaA, metaB, metaC], (_env, sessionId) => {
    const t = transcripts.get(sessionId)
    if (!t) throw new Error(`unknown: ${sessionId}`)
    return Promise.resolve(t)
  })
  registerChatRuntime(runtime)

  const report = await computeInsights(TEST_ENV, TEST_AGENT)
  assert.equal(report.daily.length, 2, 'should have two daily data points')

  const [day1, day2] = report.daily
  assert.equal(day1.date, '2024-06-01')
  assert.equal(day1.sessions, 2)
  assert.equal(day1.score, 21, 'day1 score should be round((14+28)/2)=21')

  assert.equal(day2.date, '2024-06-02')
  assert.equal(day2.sessions, 1)
  assert.equal(day2.score, 9)
})

// ── 5: mtime cache hit — readSession NOT called again ─────────────────────────

test('mtime cache hit: second computeInsights call with same mtime does not call readSession again', async () => {
  const dir = await setup()
  const filePath = await touch(dir, 'sess-cache-hit.jsonl')
  const meta = makeMeta(filePath, { id: 'sess-cache-hit' })

  let callCount = 0
  const runtime = makeRuntime([meta], (_env, _id) => {
    callCount++
    return Promise.resolve(makeTranscript(meta, [correctionMessage()]))
  })
  registerChatRuntime(runtime)

  await computeInsights(TEST_ENV, TEST_AGENT)
  assert.equal(callCount, 1, 'readSession should be called once on first call')

  // Second call with unchanged file mtime — must use cache.
  await computeInsights(TEST_ENV, TEST_AGENT)
  assert.equal(callCount, 1, 'readSession must NOT be called again on cache hit')
})

// ── 6: mtime cache miss — readSession IS called again after mtime change ───────

test('mtime cache miss: readSession is called again after file mtime changes', async () => {
  const dir = await setup()
  const filePath = await touch(dir, 'sess-cache-miss.jsonl')
  const meta = makeMeta(filePath, { id: 'sess-cache-miss' })

  let callCount = 0
  const runtime = makeRuntime([meta], (_env, _id) => {
    callCount++
    return Promise.resolve(makeTranscript(meta, [correctionMessage()]))
  })
  registerChatRuntime(runtime)

  await computeInsights(TEST_ENV, TEST_AGENT)
  assert.equal(callCount, 1)

  // Advance the file mtime by 1 second to bust the cache.
  const nowSec = Date.now() / 1000
  await fs.utimes(filePath, nowSec + 1, nowSec + 1)

  await computeInsights(TEST_ENV, TEST_AGENT)
  assert.equal(callCount, 2, 'readSession must be called again after mtime change')
})

// ── 7: cwd filter excludes sessions from other directories ────────────────────

test('cwd filter: computeInsights with opts.cwd excludes sessions from other directories', async () => {
  const dir = await setup()
  const fileIn = await touch(dir, 'sess-in.jsonl')
  const fileOut = await touch(dir, 'sess-out.jsonl')

  const metaIn = makeMeta(fileIn, {
    id: 'sess-in',
    cwd: '/home/user/myproject',
    updatedAt: '2024-06-01T10:00:00Z',
  })
  const metaOut = makeMeta(fileOut, {
    id: 'sess-out',
    cwd: '/home/user/other',
    updatedAt: '2024-06-01T10:00:00Z',
  })

  const transcripts = new Map<string, ChatTranscript>([
    ['sess-in', makeTranscript(metaIn, [correctionMessage()])],
    ['sess-out', makeTranscript(metaOut, [correctionMessage()])],
  ])

  const runtime = makeRuntime([metaIn, metaOut], (_env, sessionId) => {
    const t = transcripts.get(sessionId)
    if (!t) throw new Error(`unknown: ${sessionId}`)
    return Promise.resolve(t)
  })
  registerChatRuntime(runtime)

  const report = await computeInsights(TEST_ENV, TEST_AGENT, {
    cwd: '/home/user/myproject',
  })
  assert.equal(report.sessionsAnalyzed, 1, 'only in-project session should be analyzed')
  assert.equal(
    report.topFriction[0]?.sessionId,
    'sess-in',
    'only in-project session in topFriction',
  )
})

// ── 8: session where readSession throws is silently skipped ───────────────────

test('readSession error: throwing session is silently skipped without breaking aggregate', async () => {
  const dir = await setup()
  const fileGood = await touch(dir, 'sess-good.jsonl')
  const fileBad = await touch(dir, 'sess-bad.jsonl')

  const metaGood = makeMeta(fileGood, {
    id: 'sess-good',
    updatedAt: '2024-06-01T10:00:00Z',
  })
  const metaBad = makeMeta(fileBad, {
    id: 'sess-bad',
    updatedAt: '2024-06-01T10:00:00Z',
  })

  const runtime = makeRuntime([metaGood, metaBad], (_env, sessionId) => {
    if (sessionId === 'sess-bad') {
      return Promise.reject(new Error('disk read failed'))
    }
    return Promise.resolve(makeTranscript(metaGood, [correctionMessage()]))
  })
  registerChatRuntime(runtime)

  // Must not throw; the bad session is skipped.
  const report = await computeInsights(TEST_ENV, TEST_AGENT)
  assert.equal(report.sessionsAnalyzed, 1, 'only good session should be counted')
  assert.equal(report.totalCorrections, 1)
})
