/**
 * Tests for `paginateByMtime` in `core/chat/paginate.ts`.
 *
 * Unlike the synchronous `paginateMetas` tests in `chat-paginate.test.ts`,
 * these tests exercise the async stat-sort-parse path using real temp-dir files
 * and real `fs.utimes` calls to control modification times — no mocks.
 */

import { test } from 'node:test'
import assert from 'node:assert/strict'
import os from 'node:os'
import path from 'node:path'
import { promises as fs } from 'node:fs'

import { paginateByMtime } from '@core/chat/paginate'
import { ConfigNotFoundError } from '@core/config-error'
import type { ChatSessionMeta } from '@/shared/types/chat'

// ── helpers ───────────────────────────────────────────────────────────────────

/** Build a minimal ChatSessionMeta fixture. */
function makeMeta(
  id: string,
  filePath: string,
  updatedAt: string,
  cwd: string = '/tmp',
): ChatSessionMeta {
  return {
    id,
    agentId: 'claude',
    title: id,
    cwd,
    projectLabel: 'test',
    messageCount: 0,
    sizeBytes: 0,
    filePath,
    updatedAt,
  }
}

/**
 * Create a temp dir, write a file inside it, then set its mtime with utimes.
 * Returns `{ dir, filePath }` so the caller can clean up.
 */
async function writeWithMtime(
  dir: string,
  name: string,
  content: string,
  mtimeMs: number,
): Promise<string> {
  const filePath = path.join(dir, name)
  await fs.writeFile(filePath, content, 'utf8')
  const tSec = mtimeMs / 1000
  await fs.utimes(filePath, tSec, tSec)
  return filePath
}

// ── paginateByMtime ───────────────────────────────────────────────────────────

test('paginateByMtime: empty files array returns { sessions: [], total: 0 }', async () => {
  const parse = async (_ref: string): Promise<ChatSessionMeta | null> => null
  const result = await paginateByMtime([], undefined, parse)
  assert.deepEqual(result, { sessions: [], total: 0 })
})

test('paginateByMtime: newer file by mtime appears first in sessions', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'abyss-paginate-async-'))
  try {
    // olderMs < newerMs so the "newer" file has the higher mtime
    const olderMs = Date.now() - 10_000
    const newerMs = Date.now()

    const older = await writeWithMtime(dir, 'older.jsonl', '', olderMs)
    const newer = await writeWithMtime(dir, 'newer.jsonl', '', newerMs)

    const files = [
      { filePath: older, ref: 'older' },
      { filePath: newer, ref: 'newer' },
    ]

    const parse = async (ref: string): Promise<ChatSessionMeta | null> =>
      makeMeta(ref, path.join(dir, `${ref}.jsonl`), new Date().toISOString())

    const result = await paginateByMtime(files, undefined, parse)

    assert.equal(result.total, 2)
    assert.equal(result.sessions.length, 2)
    // mtime ordering: newer first
    assert.equal(result.sessions[0].id, 'newer')
    assert.equal(result.sessions[1].id, 'older')
  } finally {
    await fs.rm(dir, { recursive: true, force: true })
  }
})

test('paginateByMtime: offset skips leading items by mtime order', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'abyss-paginate-async-'))
  try {
    const base = Date.now()
    const fileA = await writeWithMtime(dir, 'a.jsonl', '', base + 3000)
    const fileB = await writeWithMtime(dir, 'b.jsonl', '', base + 2000)
    const fileC = await writeWithMtime(dir, 'c.jsonl', '', base + 1000)

    const files = [
      { filePath: fileA, ref: 'a' },
      { filePath: fileB, ref: 'b' },
      { filePath: fileC, ref: 'c' },
    ]

    const parse = async (ref: string): Promise<ChatSessionMeta | null> =>
      makeMeta(ref, path.join(dir, `${ref}.jsonl`), new Date().toISOString())

    // mtime order: a, b, c — offset 1 should skip 'a'
    const result = await paginateByMtime(files, { offset: 1 }, parse)

    assert.equal(result.total, 3)
    assert.equal(result.sessions.length, 2)
    const ids = result.sessions.map((s) => s.id)
    assert.ok(ids.includes('b'), 'b should be in result')
    assert.ok(ids.includes('c'), 'c should be in result')
    assert.ok(!ids.includes('a'), 'a should be skipped by offset')
  } finally {
    await fs.rm(dir, { recursive: true, force: true })
  }
})

test('paginateByMtime: limit trims the result', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'abyss-paginate-async-'))
  try {
    const base = Date.now()
    const fileA = await writeWithMtime(dir, 'a.jsonl', '', base + 3000)
    const fileB = await writeWithMtime(dir, 'b.jsonl', '', base + 2000)
    const fileC = await writeWithMtime(dir, 'c.jsonl', '', base + 1000)

    const files = [
      { filePath: fileA, ref: 'a' },
      { filePath: fileB, ref: 'b' },
      { filePath: fileC, ref: 'c' },
    ]

    const parse = async (ref: string): Promise<ChatSessionMeta | null> =>
      makeMeta(ref, path.join(dir, `${ref}.jsonl`), new Date().toISOString())

    // mtime order: a, b, c — limit 2 should return only a and b
    const result = await paginateByMtime(files, { limit: 2 }, parse)

    assert.equal(result.total, 3)
    assert.equal(result.sessions.length, 2)
    const ids = result.sessions.map((s) => s.id)
    assert.ok(ids.includes('a'), 'a should be in result')
    assert.ok(ids.includes('b'), 'b should be in result')
    assert.ok(!ids.includes('c'), 'c should be trimmed by limit')
  } finally {
    await fs.rm(dir, { recursive: true, force: true })
  }
})

test('paginateByMtime: parse returning null is excluded from sessions but not total', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'abyss-paginate-async-'))
  try {
    const base = Date.now()
    const fileA = await writeWithMtime(dir, 'a.jsonl', '', base + 2000)
    const fileB = await writeWithMtime(dir, 'b.jsonl', '', base + 1000)

    const files = [
      { filePath: fileA, ref: 'a' },
      { filePath: fileB, ref: 'b' },
    ]

    // 'a' returns null (filtered), 'b' returns a valid meta
    const parse = async (ref: string): Promise<ChatSessionMeta | null> => {
      if (ref === 'a') return null
      return makeMeta(ref, path.join(dir, `${ref}.jsonl`), new Date().toISOString())
    }

    const result = await paginateByMtime(files, undefined, parse)

    // total counts all files (not decremented for null)
    assert.equal(result.total, 2)
    // sessions only includes the non-null one
    assert.equal(result.sessions.length, 1)
    assert.equal(result.sessions[0].id, 'b')
  } finally {
    await fs.rm(dir, { recursive: true, force: true })
  }
})

test('paginateByMtime: ConfigNotFoundError is excluded from both sessions and total (TOCTOU decrement)', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'abyss-paginate-async-'))
  try {
    const base = Date.now()
    const fileA = await writeWithMtime(dir, 'a.jsonl', '', base + 2000)
    const fileB = await writeWithMtime(dir, 'b.jsonl', '', base + 1000)

    const files = [
      { filePath: fileA, ref: 'a' },
      { filePath: fileB, ref: 'b' },
    ]

    // 'a' simulates the TOCTOU path: file vanished between stat and parse
    const parse = async (ref: string): Promise<ChatSessionMeta | null> => {
      if (ref === 'a') {
        throw new ConfigNotFoundError(path.join(dir, 'a.jsonl'))
      }
      return makeMeta(ref, path.join(dir, `${ref}.jsonl`), new Date().toISOString())
    }

    const result = await paginateByMtime(files, undefined, parse)

    // total is decremented for ConfigNotFoundError
    assert.equal(result.total, 1)
    assert.equal(result.sessions.length, 1)
    assert.equal(result.sessions[0].id, 'b')
  } finally {
    await fs.rm(dir, { recursive: true, force: true })
  }
})

test('paginateByMtime: non-ConfigNotFoundError parse rejection propagates (not swallowed)', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'abyss-paginate-async-'))
  try {
    const base = Date.now()
    const fileA = await writeWithMtime(dir, 'a.jsonl', '', base + 1000)

    const files = [{ filePath: fileA, ref: 'a' }]

    const boom = new Error('unexpected parse failure')
    const parse = async (_ref: string): Promise<ChatSessionMeta | null> => {
      throw boom
    }

    await assert.rejects(
      () => paginateByMtime(files, undefined, parse),
      (err: unknown) => {
        assert.strictEqual(err, boom)
        return true
      },
    )
  } finally {
    await fs.rm(dir, { recursive: true, force: true })
  }
})
