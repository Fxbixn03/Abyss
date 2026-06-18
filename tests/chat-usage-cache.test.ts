/**
 * Tests for `core/chat/usage.ts` — mtime-based caching of transcript metadata.
 *
 * Strategy: inject a lightweight stub `ChatRuntime` (via the exported
 * `registerChatRuntime` / `unregisterChatRuntime`) whose `usage` source is
 * fully controlled by the test — no real agent binaries or config directories
 * involved. Real temporary files on disk are used so that `fs.stat` returns
 * genuine mtime values.
 *
 * Covers:
 *  1–2.  Cache hit: same `ChatSessionMeta` object reference on repeated call
 *        with unchanged mtime.
 *  3–4.  Cache miss: modified mtime forces re-parse of that file; other
 *        cached files are untouched.
 *  5–6.  `invalidateUsageCache`: clears all entries so next call re-reads.
 *  7–8.  TOCTOU skip: `ConfigNotFoundError` thrown by `readMeta` is swallowed
 *        without affecting the rest of the result set.
 *  9.    Agent without a `usage` source returns an empty `ChatUsageStats`.
 *  10.   Unregistered agent ID returns an empty `ChatUsageStats`.
 *  11.   Token aggregation across multiple sessions is correct.
 *  12.   `computeUsageStats` with a `cwd` filter excludes out-of-tree sessions.
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
  computeUsageStats,
  invalidateUsageCache,
} from '@core/chat/usage'
import { ConfigNotFoundError } from '@core/config-error'

// ── helpers ───────────────────────────────────────────────────────────────────

const TEST_ENV: OsEnv = {
  home: os.homedir(),
  appData: os.homedir(),
  platform: process.platform === 'win32' ? 'win32' : 'linux',
}

let tmpDir = ''

async function setup(): Promise<string> {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'abyss-usage-test-'))
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
    agentId: 'claude',
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

/**
 * Build a minimal stub `ChatRuntime` with a controlled `usage` source.
 * `readMetaImpl` can be swapped per-call to simulate errors.
 */
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
    // The remaining ChatRuntime methods are unused by `computeUsageStats`; stub them.
    listSessions: () => { throw new Error('not implemented') },
    readSession: () => { throw new Error('not implemented') },
    deleteSession: () => { throw new Error('not implemented') },
    availability: () => { throw new Error('not implemented') },
    login: () => { throw new Error('not implemented') },
    logout: () => { throw new Error('not implemented') },
    start: () => { throw new Error('not implemented') },
  }
}

// Cleanup after each test: evict the cache and remove the test agent registration.
const TEST_AGENT = 'test-usage-agent'
afterEach(async () => {
  invalidateUsageCache()
  unregisterChatRuntime(TEST_AGENT)
  await teardown()
})

// ── 1–2: cache hit returns same object reference ──────────────────────────────

test('cache hit: second call with unchanged mtime returns same ChatSessionMeta reference', async () => {
  const dir = await setup()
  const filePath = await touch(dir, 'session-a.jsonl')

  let callCount = 0
  const refs: ChatSessionFileRef[] = [{ filePath }]
  const meta = makeMeta(filePath)
  const runtime = makeRuntime(TEST_AGENT, refs, async () => {
    callCount++
    return meta
  })
  registerChatRuntime(runtime)

  const stats1 = await computeUsageStats(TEST_ENV, TEST_AGENT)
  assert.equal(stats1.totalSessions, 1, 'first call should see one session')
  assert.equal(callCount, 1, 'readMeta called once on first call')

  const stats2 = await computeUsageStats(TEST_ENV, TEST_AGENT)
  assert.equal(stats2.totalSessions, 1, 'second call should still see one session')
  // readMeta must NOT be called again — mtime unchanged
  assert.equal(callCount, 1, 'readMeta must not be called on cache hit')
})

test('cache hit: recent array entry is the identical object reference on the second call', async () => {
  const dir = await setup()
  const filePath = await touch(dir, 'session-b.jsonl')

  const refs: ChatSessionFileRef[] = [{ filePath }]
  const meta = makeMeta(filePath)
  const runtime = makeRuntime(TEST_AGENT, refs, async () => meta)
  registerChatRuntime(runtime)

  const stats1 = await computeUsageStats(TEST_ENV, TEST_AGENT)
  const stats2 = await computeUsageStats(TEST_ENV, TEST_AGENT)

  // Both calls must return the same underlying meta object (===, not just deep-equal)
  assert.equal(stats1.recent[0], stats2.recent[0], 'cache hit must return same object reference')
})

// ── 3–4: cache miss on mtime change ──────────────────────────────────────────

test('cache miss: changing a file mtime forces re-parse of that file', async () => {
  const dir = await setup()
  const filePath = await touch(dir, 'session-c.jsonl')

  let callCount = 0
  const refs: ChatSessionFileRef[] = [{ filePath }]
  const runtime = makeRuntime(TEST_AGENT, refs, async () => {
    callCount++
    return makeMeta(filePath, { messageCount: callCount })
  })
  registerChatRuntime(runtime)

  await computeUsageStats(TEST_ENV, TEST_AGENT)
  assert.equal(callCount, 1)

  // Advance the mtime by 1 second via utimes
  const now = Date.now() / 1000
  await fs.utimes(filePath, now + 1, now + 1)

  const stats2 = await computeUsageStats(TEST_ENV, TEST_AGENT)
  assert.equal(callCount, 2, 'readMeta must be called again after mtime change')
  assert.equal(stats2.totalMessages, 2, 'second call should reflect re-parsed messageCount')
})

test('cache miss: unchanged file stays cached while changed file is re-parsed', async () => {
  const dir = await setup()
  const fileA = await touch(dir, 'stable.jsonl')
  const fileB = await touch(dir, 'changed.jsonl')

  const parseCounts: Record<string, number> = { [fileA]: 0, [fileB]: 0 }
  const refs: ChatSessionFileRef[] = [{ filePath: fileA }, { filePath: fileB }]
  const runtime = makeRuntime(TEST_AGENT, refs, async (ref) => {
    parseCounts[ref.filePath]++
    return makeMeta(ref.filePath)
  })
  registerChatRuntime(runtime)

  await computeUsageStats(TEST_ENV, TEST_AGENT)
  assert.equal(parseCounts[fileA], 1)
  assert.equal(parseCounts[fileB], 1)

  // Advance only fileB's mtime
  const now = Date.now() / 1000
  await fs.utimes(fileB, now + 2, now + 2)

  await computeUsageStats(TEST_ENV, TEST_AGENT)
  // fileA must remain cached (parse count stays at 1)
  assert.equal(parseCounts[fileA], 1, 'stable file must remain cached')
  // fileB must be re-parsed
  assert.equal(parseCounts[fileB], 2, 'changed file must be re-parsed')
})

// ── 5–6: invalidateUsageCache ─────────────────────────────────────────────────

test('invalidateUsageCache: next call re-reads all files', async () => {
  const dir = await setup()
  const filePath = await touch(dir, 'session-d.jsonl')

  let callCount = 0
  const refs: ChatSessionFileRef[] = [{ filePath }]
  const runtime = makeRuntime(TEST_AGENT, refs, async () => {
    callCount++
    return makeMeta(filePath)
  })
  registerChatRuntime(runtime)

  await computeUsageStats(TEST_ENV, TEST_AGENT)
  assert.equal(callCount, 1)

  // Invalidate without changing mtime — cache should be gone
  invalidateUsageCache()

  await computeUsageStats(TEST_ENV, TEST_AGENT)
  assert.equal(callCount, 2, 'invalidateUsageCache must force a re-read')
})

test('invalidateUsageCache: calling it twice is idempotent', async () => {
  const dir = await setup()
  const filePath = await touch(dir, 'session-e.jsonl')

  let callCount = 0
  const refs: ChatSessionFileRef[] = [{ filePath }]
  const runtime = makeRuntime(TEST_AGENT, refs, async () => {
    callCount++
    return makeMeta(filePath)
  })
  registerChatRuntime(runtime)

  await computeUsageStats(TEST_ENV, TEST_AGENT)
  invalidateUsageCache()
  invalidateUsageCache() // second clear is a no-op on an already-empty map

  await computeUsageStats(TEST_ENV, TEST_AGENT)
  assert.equal(callCount, 2, 'double invalidation still forces exactly one re-read')
})

// ── 7–8: ConfigNotFoundError TOCTOU skip ─────────────────────────────────────

test('TOCTOU skip: ConfigNotFoundError from readMeta skips that file without error', async () => {
  const dir = await setup()
  const fileGood = await touch(dir, 'good.jsonl')
  const fileBad = await touch(dir, 'bad.jsonl')

  const refs: ChatSessionFileRef[] = [{ filePath: fileGood }, { filePath: fileBad }]
  const runtime = makeRuntime(TEST_AGENT, refs, async (ref) => {
    if (ref.filePath === fileBad) {
      throw new ConfigNotFoundError(ref.filePath)
    }
    return makeMeta(ref.filePath)
  })
  registerChatRuntime(runtime)

  const stats = await computeUsageStats(TEST_ENV, TEST_AGENT)
  // Bad file is skipped; only good file contributes
  assert.equal(stats.totalSessions, 1, 'ConfigNotFoundError file must be skipped')
  assert.equal(stats.recent[0].filePath, fileGood, 'only good file must appear in result')
})

test('TOCTOU skip: non-existent file path causes stat failure, also skipped gracefully', async () => {
  const dir = await setup()
  const realFile = await touch(dir, 'real.jsonl')
  const ghostFile = path.join(dir, 'ghost.jsonl') // never written to disk

  const refs: ChatSessionFileRef[] = [{ filePath: realFile }, { filePath: ghostFile }]
  let readMetaCalled = false
  const runtime = makeRuntime(TEST_AGENT, refs, async (ref) => {
    if (ref.filePath === ghostFile) {
      readMetaCalled = true
    }
    return makeMeta(ref.filePath)
  })
  registerChatRuntime(runtime)

  const stats = await computeUsageStats(TEST_ENV, TEST_AGENT)
  // Ghost file causes fs.stat to throw; it is skipped silently
  assert.equal(stats.totalSessions, 1, 'ghost file must be skipped')
  assert.equal(readMetaCalled, false, 'readMeta must not be called for a file that stat-fails')
})

// ── 9: agent with no usage source ────────────────────────────────────────────

test('no usage source: runtime without usage returns empty stats without throwing', async () => {
  const runtime = makeRuntime(TEST_AGENT, [], async () => null, false /* includeUsage=false */)
  registerChatRuntime(runtime)

  const stats = await computeUsageStats(TEST_ENV, TEST_AGENT)
  assert.equal(stats.totalSessions, 0)
  assert.equal(stats.totalMessages, 0)
  assert.equal(stats.inputTokens, 0)
  assert.equal(stats.outputTokens, 0)
})

// ── 10: unregistered agent ID ─────────────────────────────────────────────────

test('unregistered agent: computeUsageStats returns empty stats for unknown agent', async () => {
  // TEST_AGENT is not registered (afterEach removes it; this test runs before registration)
  const stats = await computeUsageStats(TEST_ENV, 'completely-unknown-agent-xyz')
  assert.equal(stats.totalSessions, 0)
  assert.equal(stats.totalMessages, 0)
  assert.equal(stats.inputTokens, 0)
  assert.equal(stats.outputTokens, 0)
  assert.deepEqual(stats.recent, [])
})

// ── 11: token aggregation ─────────────────────────────────────────────────────

test('token aggregation: inputTokens and outputTokens are summed across sessions', async () => {
  const dir = await setup()
  const fileA = await touch(dir, 'tok-a.jsonl')
  const fileB = await touch(dir, 'tok-b.jsonl')
  const fileC = await touch(dir, 'tok-c.jsonl')

  const refs: ChatSessionFileRef[] = [
    { filePath: fileA },
    { filePath: fileB },
    { filePath: fileC },
  ]
  const tokenMap: Record<string, { input: number; output: number }> = {
    [fileA]: { input: 100, output: 50 },
    [fileB]: { input: 200, output: 75 },
    [fileC]: { input: 300, output: 100 },
  }
  const runtime = makeRuntime(TEST_AGENT, refs, async (ref) =>
    makeMeta(ref.filePath, {
      inputTokens: tokenMap[ref.filePath].input,
      outputTokens: tokenMap[ref.filePath].output,
    }),
  )
  registerChatRuntime(runtime)

  const stats = await computeUsageStats(TEST_ENV, TEST_AGENT)
  assert.equal(stats.totalSessions, 3)
  assert.equal(stats.inputTokens, 600, 'inputTokens should sum to 600')
  assert.equal(stats.outputTokens, 225, 'outputTokens should sum to 225')
})

// ── 12: cwd filter ────────────────────────────────────────────────────────────

test('cwd filter: computeUsageStats with opts.cwd excludes sessions from other directories', async () => {
  const dir = await setup()
  const fileIn = await touch(dir, 'in-proj.jsonl')
  const fileOut = await touch(dir, 'out-proj.jsonl')

  const refs: ChatSessionFileRef[] = [
    { filePath: fileIn },
    { filePath: fileOut },
  ]
  const runtime = makeRuntime(TEST_AGENT, refs, async (ref) => {
    const isIn = ref.filePath === fileIn
    return makeMeta(ref.filePath, {
      cwd: isIn ? '/home/user/myproject' : '/home/user/other',
    })
  })
  registerChatRuntime(runtime)

  const stats = await computeUsageStats(TEST_ENV, TEST_AGENT, {
    cwd: '/home/user/myproject',
  })
  assert.equal(stats.totalSessions, 1, 'only in-project session should be included')
  assert.equal(stats.recent[0].filePath, fileIn, 'included session must be the in-project one')
})
