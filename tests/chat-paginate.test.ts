/**
 * Tests for `core/chat/paginate.ts` and `core/chat/jsonl.ts`.
 *
 * All pure helpers run synchronously; `readJsonl` is exercised against real
 * temp files so the JSONL streaming path is covered end-to-end without mocks.
 */

import { test } from 'node:test'
import assert from 'node:assert/strict'
import os from 'node:os'
import path from 'node:path'
import { promises as fs } from 'node:fs'

import { isUnderDir, paginateMetas } from '@core/chat/paginate'
import { asString, asRecord, readJsonl } from '@core/chat/jsonl'
import type { ChatSessionMeta } from '@/shared/types/chat'

// ── helpers ───────────────────────────────────────────────────────────────────

/** Build a minimal ChatSessionMeta with only the fields under test. */
function makeMeta(
  id: string,
  updatedAt: string,
  overrides: Partial<ChatSessionMeta> = {},
): ChatSessionMeta {
  return {
    id,
    agentId: 'claude',
    title: id,
    cwd: '/tmp',
    projectLabel: 'test',
    messageCount: 0,
    sizeBytes: 0,
    filePath: `/tmp/${id}.jsonl`,
    updatedAt,
    ...overrides,
  }
}

async function writeTmp(content: string): Promise<string> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'abyss-test-jsonl-'))
  const file = path.join(dir, 'test.jsonl')
  await fs.writeFile(file, content, 'utf8')
  return file
}

// ── isUnderDir ────────────────────────────────────────────────────────────────

test('isUnderDir: identical paths return true', () => {
  assert.ok(isUnderDir('/home/user/project', '/home/user/project'))
})

test('isUnderDir: child path returns true', () => {
  assert.ok(isUnderDir('/home/user/project/src/file.ts', '/home/user/project'))
})

test('isUnderDir: sibling path returns false', () => {
  assert.ok(!isUnderDir('/home/user/other', '/home/user/project'))
})

test('isUnderDir: child with trailing slash on parent returns true', () => {
  assert.ok(isUnderDir('/home/user/project/src', '/home/user/project/'))
})

test('isUnderDir: identical paths with trailing slash on child returns true', () => {
  assert.ok(isUnderDir('/home/user/project/', '/home/user/project'))
})

test('isUnderDir: Windows backslash child returns true', () => {
  assert.ok(isUnderDir('C:\\Users\\user\\project\\src', 'C:\\Users\\user\\project'))
})

test('isUnderDir: path that is a prefix but not a parent directory returns false', () => {
  // /home/user/projectX is NOT under /home/user/project
  assert.ok(!isUnderDir('/home/user/projectX', '/home/user/project'))
})

// ── paginateMetas ─────────────────────────────────────────────────────────────

test('paginateMetas: empty array returns { sessions: [], total: 0 }', () => {
  const result = paginateMetas([], undefined)
  assert.deepEqual(result, { sessions: [], total: 0 })
})

test('paginateMetas: items are sorted newest-first by updatedAt', () => {
  const metas = [
    makeMeta('a', '2024-01-01T00:00:00Z'),
    makeMeta('b', '2024-03-01T00:00:00Z'),
    makeMeta('c', '2024-02-01T00:00:00Z'),
  ]
  const result = paginateMetas(metas, undefined)
  assert.equal(result.total, 3)
  assert.equal(result.sessions[0].id, 'b')
  assert.equal(result.sessions[1].id, 'c')
  assert.equal(result.sessions[2].id, 'a')
})

test('paginateMetas: offset skips the correct leading items', () => {
  const metas = [
    makeMeta('a', '2024-01-01T00:00:00Z'),
    makeMeta('b', '2024-03-01T00:00:00Z'),
    makeMeta('c', '2024-02-01T00:00:00Z'),
  ]
  const result = paginateMetas(metas, { offset: 1 })
  // After sorting: b, c, a. Offset 1 skips b.
  assert.equal(result.total, 3)
  assert.equal(result.sessions.length, 2)
  assert.equal(result.sessions[0].id, 'c')
  assert.equal(result.sessions[1].id, 'a')
})

test('paginateMetas: limit trims the tail', () => {
  const metas = [
    makeMeta('a', '2024-01-01T00:00:00Z'),
    makeMeta('b', '2024-03-01T00:00:00Z'),
    makeMeta('c', '2024-02-01T00:00:00Z'),
  ]
  const result = paginateMetas(metas, { limit: 2 })
  // After sorting: b, c, a. Limit 2 returns b, c.
  assert.equal(result.total, 3)
  assert.equal(result.sessions.length, 2)
  assert.equal(result.sessions[0].id, 'b')
  assert.equal(result.sessions[1].id, 'c')
})

test('paginateMetas: offset + limit returns the correct slice', () => {
  const metas = [
    makeMeta('a', '2024-01-01T00:00:00Z'),
    makeMeta('b', '2024-04-01T00:00:00Z'),
    makeMeta('c', '2024-03-01T00:00:00Z'),
    makeMeta('d', '2024-02-01T00:00:00Z'),
  ]
  // After sorting: b, c, d, a. offset=1, limit=2 → c, d
  const result = paginateMetas(metas, { offset: 1, limit: 2 })
  assert.equal(result.total, 4)
  assert.equal(result.sessions.length, 2)
  assert.equal(result.sessions[0].id, 'c')
  assert.equal(result.sessions[1].id, 'd')
})

test('paginateMetas: offset beyond length returns empty sessions but correct total', () => {
  const metas = [makeMeta('a', '2024-01-01T00:00:00Z')]
  const result = paginateMetas(metas, { offset: 5 })
  assert.equal(result.total, 1)
  assert.equal(result.sessions.length, 0)
})

test('paginateMetas: negative offset is clamped to zero', () => {
  const metas = [
    makeMeta('a', '2024-01-01T00:00:00Z'),
    makeMeta('b', '2024-02-01T00:00:00Z'),
  ]
  const result = paginateMetas(metas, { offset: -10 })
  assert.equal(result.sessions.length, 2)
})

// ── asString ──────────────────────────────────────────────────────────────────

test('asString: returns the value for a string input', () => {
  assert.equal(asString('hello'), 'hello')
})

test('asString: returns undefined for a number', () => {
  assert.equal(asString(42), undefined)
})

test('asString: returns undefined for a plain object', () => {
  assert.equal(asString({ x: 1 }), undefined)
})

test('asString: returns undefined for null', () => {
  assert.equal(asString(null), undefined)
})

test('asString: returns undefined for undefined', () => {
  assert.equal(asString(undefined), undefined)
})

test('asString: returns an empty string for an empty string input', () => {
  assert.equal(asString(''), '')
})

// ── asRecord ──────────────────────────────────────────────────────────────────

test('asRecord: returns the value for a plain object', () => {
  const obj = { key: 'value', num: 1 }
  assert.deepEqual(asRecord(obj), obj)
})

test('asRecord: returns undefined for an array', () => {
  assert.equal(asRecord([1, 2, 3]), undefined)
})

test('asRecord: returns undefined for a string', () => {
  assert.equal(asRecord('hello'), undefined)
})

test('asRecord: returns undefined for null', () => {
  assert.equal(asRecord(null), undefined)
})

test('asRecord: returns undefined for undefined', () => {
  assert.equal(asRecord(undefined), undefined)
})

test('asRecord: returns undefined for a number', () => {
  assert.equal(asRecord(42), undefined)
})

test('asRecord: returns an empty object for {}', () => {
  assert.deepEqual(asRecord({}), {})
})

// ── readJsonl (async, temp file) ──────────────────────────────────────────────

test('readJsonl: two-line JSONL with one malformed line returns only the valid object', async () => {
  const file = await writeTmp(
    '{"type":"message","role":"user"}\nnot-valid-json\n',
  )
  try {
    const result = await readJsonl(file)
    assert.equal(result.length, 1)
    assert.deepEqual(result[0], { type: 'message', role: 'user' })
  } finally {
    await fs.rm(path.dirname(file), { recursive: true, force: true })
  }
})

test('readJsonl: empty file returns an empty array', async () => {
  const file = await writeTmp('')
  try {
    const result = await readJsonl(file)
    assert.deepEqual(result, [])
  } finally {
    await fs.rm(path.dirname(file), { recursive: true, force: true })
  }
})

test('readJsonl: file with only whitespace and blank lines returns an empty array', async () => {
  const file = await writeTmp('   \n\n  \n')
  try {
    const result = await readJsonl(file)
    assert.deepEqual(result, [])
  } finally {
    await fs.rm(path.dirname(file), { recursive: true, force: true })
  }
})

test('readJsonl: multiple valid JSON objects are all returned', async () => {
  const lines = [
    JSON.stringify({ id: '1', value: 'a' }),
    JSON.stringify({ id: '2', value: 'b' }),
    JSON.stringify({ id: '3', value: 'c' }),
  ].join('\n')
  const file = await writeTmp(lines + '\n')
  try {
    const result = await readJsonl(file)
    assert.equal(result.length, 3)
    assert.deepEqual(result[0], { id: '1', value: 'a' })
    assert.deepEqual(result[1], { id: '2', value: 'b' })
    assert.deepEqual(result[2], { id: '3', value: 'c' })
  } finally {
    await fs.rm(path.dirname(file), { recursive: true, force: true })
  }
})

test('readJsonl: JSON primitive values (string, number) on a line are skipped', async () => {
  // Only object-typed parsed values are yielded (checked via typeof === 'object').
  // Strings and numbers are not objects and are skipped.
  const file = await writeTmp('"a string"\n42\n{"ok":true}\n')
  try {
    const result = await readJsonl(file)
    assert.equal(result.length, 1)
    assert.deepEqual(result[0], { ok: true })
  } finally {
    await fs.rm(path.dirname(file), { recursive: true, force: true })
  }
})
