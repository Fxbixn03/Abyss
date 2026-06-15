/**
 * Pure-helper tests for src/features/config/lib/diff.ts (node:test). The LCS
 * line-diff functions are deterministic and side-effect-free — no disk access,
 * no process spawning, so these tests are cheap and CI-safe.
 */

import { test } from 'node:test'
import assert from 'node:assert/strict'

import { lineDiff, diffStats } from '@/features/config/lib/diff'

// ── lineDiff: identical content ───────────────────────────────────────────────

test('lineDiff: identical single-line strings produce one context line', () => {
  const result = lineDiff('hello', 'hello')
  assert.equal(result.length, 1)
  assert.equal(result[0].type, 'context')
  assert.equal(result[0].text, 'hello')
})

test('lineDiff: identical multi-line strings produce only context lines', () => {
  const content = 'line one\nline two\nline three'
  const result = lineDiff(content, content)
  assert.equal(result.length, 3)
  assert.ok(result.every((l) => l.type === 'context'))
  assert.deepEqual(
    result.map((l) => l.text),
    ['line one', 'line two', 'line three'],
  )
})

test('lineDiff: identical empty strings produce one context line (empty string)', () => {
  const result = lineDiff('', '')
  // ''.split('\n') → [''], so one context line with an empty string
  assert.equal(result.length, 1)
  assert.equal(result[0].type, 'context')
  assert.equal(result[0].text, '')
})

// ── lineDiff: fully replaced content ─────────────────────────────────────────

test('lineDiff: fully replaced single line produces one remove then one add', () => {
  const result = lineDiff('old line', 'new line')
  assert.equal(result.length, 2)
  assert.equal(result[0].type, 'remove')
  assert.equal(result[0].text, 'old line')
  assert.equal(result[1].type, 'add')
  assert.equal(result[1].text, 'new line')
})

test('lineDiff: fully replaced multi-line content has all removes before all adds', () => {
  const before = 'alpha\nbeta\ngamma'
  const after = 'uno\ndos\ntres'
  const result = lineDiff(before, after)

  // No shared lines, so all 3 old lines are removes and 3 new lines are adds.
  const removes = result.filter((l) => l.type === 'remove')
  const adds = result.filter((l) => l.type === 'add')
  const contexts = result.filter((l) => l.type === 'context')

  assert.equal(removes.length, 3)
  assert.equal(adds.length, 3)
  assert.equal(contexts.length, 0)

  // Removes must appear before adds in the output array.
  const firstAddIndex = result.findIndex((l) => l.type === 'add')
  const lastRemoveIndex = result.map((l) => l.type).lastIndexOf('remove')
  assert.ok(
    lastRemoveIndex < firstAddIndex,
    'all removes must come before all adds when content is fully replaced',
  )

  assert.deepEqual(
    removes.map((l) => l.text),
    ['alpha', 'beta', 'gamma'],
  )
  assert.deepEqual(
    adds.map((l) => l.text),
    ['uno', 'dos', 'tres'],
  )
})

// ── lineDiff: empty before / after ───────────────────────────────────────────

test('lineDiff: empty before, non-empty after → all adds', () => {
  // ''.split('\n') → [''] (one empty line), so the empty "line" is removed
  // and the new content lines are added.
  const result = lineDiff('', 'first\nsecond')
  const removes = result.filter((l) => l.type === 'remove')
  const adds = result.filter((l) => l.type === 'add')
  assert.equal(removes.length, 1)
  assert.equal(removes[0].text, '')
  assert.equal(adds.length, 2)
  assert.deepEqual(
    adds.map((l) => l.text),
    ['first', 'second'],
  )
})

test('lineDiff: non-empty before, empty after → all removes', () => {
  const result = lineDiff('first\nsecond', '')
  const removes = result.filter((l) => l.type === 'remove')
  const adds = result.filter((l) => l.type === 'add')
  assert.equal(removes.length, 2)
  assert.deepEqual(
    removes.map((l) => l.text),
    ['first', 'second'],
  )
  assert.equal(adds.length, 1)
  assert.equal(adds[0].text, '')
})

// ── lineDiff: trailing-newline edge cases ─────────────────────────────────────

test('lineDiff: trailing newline is represented as a trailing empty-string line', () => {
  // 'a\n'.split('\n') → ['a', ''] — two lines, second is empty.
  const result = lineDiff('a\n', 'a\n')
  assert.equal(result.length, 2)
  assert.ok(result.every((l) => l.type === 'context'))
  assert.equal(result[0].text, 'a')
  assert.equal(result[1].text, '')
})

test('lineDiff: adding a trailing newline shows the empty line as an add', () => {
  // Before: ['a']  (no trailing newline)
  // After:  ['a', '']  (trailing newline creates an extra empty element)
  const result = lineDiff('a', 'a\n')
  const contexts = result.filter((l) => l.type === 'context')
  const adds = result.filter((l) => l.type === 'add')
  const removes = result.filter((l) => l.type === 'remove')
  assert.equal(contexts.length, 1)
  assert.equal(contexts[0].text, 'a')
  assert.equal(adds.length, 1)
  assert.equal(adds[0].text, '')
  assert.equal(removes.length, 0)
})

test('lineDiff: removing a trailing newline shows the empty line as a remove', () => {
  const result = lineDiff('a\n', 'a')
  const contexts = result.filter((l) => l.type === 'context')
  const removes = result.filter((l) => l.type === 'remove')
  const adds = result.filter((l) => l.type === 'add')
  assert.equal(contexts.length, 1)
  assert.equal(contexts[0].text, 'a')
  assert.equal(removes.length, 1)
  assert.equal(removes[0].text, '')
  assert.equal(adds.length, 0)
})

test('lineDiff: strings with only newlines differ by their empty-line counts', () => {
  // '\n' → ['', ''] (2 lines), '\n\n' → ['', '', ''] (3 lines)
  const result = lineDiff('\n', '\n\n')
  const total = result.length
  const adds = result.filter((l) => l.type === 'add')
  // One extra empty line is added; the two shared empty lines are context.
  assert.equal(adds.length, 1)
  assert.equal(adds[0].text, '')
  assert.equal(total, 3) // 2 context + 1 add
})

// ── lineDiff: mixed changes with context ──────────────────────────────────────

test('lineDiff: changed lines are surrounded by context lines', () => {
  const before = 'header\nold body\nfooter'
  const after = 'header\nnew body\nfooter'
  const result = lineDiff(before, after)

  assert.equal(result.length, 4)
  assert.equal(result[0].type, 'context')
  assert.equal(result[0].text, 'header')
  assert.equal(result[1].type, 'remove')
  assert.equal(result[1].text, 'old body')
  assert.equal(result[2].type, 'add')
  assert.equal(result[2].text, 'new body')
  assert.equal(result[3].type, 'context')
  assert.equal(result[3].text, 'footer')
})

// ── diffStats ─────────────────────────────────────────────────────────────────

test('diffStats: returns zero counts for an empty array', () => {
  const stats = diffStats([])
  assert.equal(stats.added, 0)
  assert.equal(stats.removed, 0)
})

test('diffStats: counts match the lineDiff output for identical strings', () => {
  const lines = lineDiff('same\ncontent', 'same\ncontent')
  const stats = diffStats(lines)
  assert.equal(stats.added, 0)
  assert.equal(stats.removed, 0)
})

test('diffStats: counts match the lineDiff output for fully replaced content', () => {
  const lines = lineDiff('a\nb\nc', 'x\ny\nz')
  const stats = diffStats(lines)
  assert.equal(stats.removed, lines.filter((l) => l.type === 'remove').length)
  assert.equal(stats.added, lines.filter((l) => l.type === 'add').length)
  assert.equal(stats.removed, 3)
  assert.equal(stats.added, 3)
})

test('diffStats: counts match the lineDiff output for a mixed diff', () => {
  const lines = lineDiff('header\nold\nfooter', 'header\nnew\nfooter')
  const stats = diffStats(lines)
  assert.equal(stats.removed, lines.filter((l) => l.type === 'remove').length)
  assert.equal(stats.added, lines.filter((l) => l.type === 'add').length)
  assert.equal(stats.removed, 1)
  assert.equal(stats.added, 1)
})

test('diffStats: counts match the lineDiff output for insertions only', () => {
  const lines = lineDiff('a\nb', 'a\nnew line\nb')
  const stats = diffStats(lines)
  assert.equal(stats.added, lines.filter((l) => l.type === 'add').length)
  assert.equal(stats.removed, lines.filter((l) => l.type === 'remove').length)
  assert.equal(stats.added, 1)
  assert.equal(stats.removed, 0)
})

test('diffStats: counts match the lineDiff output for deletions only', () => {
  const lines = lineDiff('a\nremoved\nb', 'a\nb')
  const stats = diffStats(lines)
  assert.equal(stats.removed, lines.filter((l) => l.type === 'remove').length)
  assert.equal(stats.added, lines.filter((l) => l.type === 'add').length)
  assert.equal(stats.removed, 1)
  assert.equal(stats.added, 0)
})

test('diffStats: counts match the lineDiff output for trailing-newline diff', () => {
  const lines = lineDiff('a', 'a\n')
  const stats = diffStats(lines)
  assert.equal(stats.added, lines.filter((l) => l.type === 'add').length)
  assert.equal(stats.removed, lines.filter((l) => l.type === 'remove').length)
  assert.equal(stats.added, 1)
  assert.equal(stats.removed, 0)
})
