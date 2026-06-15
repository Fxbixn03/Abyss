/**
 * Pure-helper tests for src/shared/lib/lineDiff.ts (node:test).
 * This is the side-by-side DiffRow implementation used by LineDiffView in
 * the Compare and History views — distinct from the unified diff in
 * src/features/config/lib/diff.ts. All tests are deterministic and
 * side-effect-free.
 */

import { test } from 'node:test'
import assert from 'node:assert/strict'

import { lineDiff } from '@/shared/lib/lineDiff'

// ── identical inputs ──────────────────────────────────────────────────────────

test('lineDiff: identical single-line input produces one same row', () => {
  const rows = lineDiff('hello', 'hello')
  assert.equal(rows.length, 1)
  assert.equal(rows[0].type, 'same')
  assert.equal(rows[0].left, 'hello')
  assert.equal(rows[0].right, 'hello')
})

test('lineDiff: identical multi-line input produces only same rows', () => {
  const content = 'line one\nline two\nline three'
  const rows = lineDiff(content, content)
  assert.equal(rows.length, 3)
  assert.ok(rows.every((r) => r.type === 'same'))
  assert.deepEqual(
    rows.map((r) => r.left),
    ['line one', 'line two', 'line three'],
  )
  assert.deepEqual(
    rows.map((r) => r.right),
    ['line one', 'line two', 'line three'],
  )
})

test('lineDiff: identical empty strings produce one same row with empty left and right', () => {
  // ''.split('\n') → [''] — one line that is the empty string
  const rows = lineDiff('', '')
  assert.equal(rows.length, 1)
  assert.equal(rows[0].type, 'same')
  assert.equal(rows[0].left, '')
  assert.equal(rows[0].right, '')
})

// ── full replacement ──────────────────────────────────────────────────────────

test('lineDiff: fully replaced single line produces one remove then one add row', () => {
  const rows = lineDiff('old line', 'new line')
  assert.equal(rows.length, 2)
  assert.equal(rows[0].type, 'remove')
  assert.equal(rows[0].left, 'old line')
  assert.equal(rows[0].right, undefined)
  assert.equal(rows[1].type, 'add')
  assert.equal(rows[1].right, 'new line')
  assert.equal(rows[1].left, undefined)
})

test('lineDiff: fully replaced multi-line content has correct left/right fields', () => {
  const before = 'alpha\nbeta\ngamma'
  const after = 'uno\ndos\ntres'
  const rows = lineDiff(before, after)

  const removes = rows.filter((r) => r.type === 'remove')
  const adds = rows.filter((r) => r.type === 'add')
  const sames = rows.filter((r) => r.type === 'same')

  assert.equal(removes.length, 3)
  assert.equal(adds.length, 3)
  assert.equal(sames.length, 0)

  // remove rows: left field is set, right is undefined
  assert.deepEqual(
    removes.map((r) => r.left),
    ['alpha', 'beta', 'gamma'],
  )
  assert.ok(removes.every((r) => r.right === undefined))

  // add rows: right field is set, left is undefined
  assert.deepEqual(
    adds.map((r) => r.right),
    ['uno', 'dos', 'tres'],
  )
  assert.ok(adds.every((r) => r.left === undefined))
})

test('lineDiff: fully replaced content interleaves remove/add rows based on LCS ordering', () => {
  // With no shared lines the LCS algorithm determines ordering but all removes
  // precede all adds since dp[i+1][j] >= dp[i][j+1] is always true (all zeros).
  const rows = lineDiff('x\ny', 'a\nb')
  const firstAddIndex = rows.findIndex((r) => r.type === 'add')
  const lastRemoveIndex = rows.map((r) => r.type).lastIndexOf('remove')
  assert.ok(
    firstAddIndex === -1 || lastRemoveIndex < firstAddIndex,
    'when no lines are shared all removes appear before all adds',
  )
})

// ── insertions only ───────────────────────────────────────────────────────────

test('lineDiff: single insertion in the middle produces correct same/add rows', () => {
  const rows = lineDiff('a\nb', 'a\nnew\nb')
  // ['a', 'b'] vs ['a', 'new', 'b'] — LCS is ['a', 'b'], add 'new' in between
  assert.equal(rows.length, 3)
  assert.equal(rows[0].type, 'same')
  assert.equal(rows[0].left, 'a')
  assert.equal(rows[1].type, 'add')
  assert.equal(rows[1].right, 'new')
  assert.equal(rows[1].left, undefined)
  assert.equal(rows[2].type, 'same')
  assert.equal(rows[2].left, 'b')
})

test('lineDiff: multiple insertions produce correct add rows', () => {
  const rows = lineDiff('a\nb', 'a\nfoo\nbar\nb')
  const adds = rows.filter((r) => r.type === 'add')
  assert.equal(adds.length, 2)
  assert.deepEqual(
    adds.map((r) => r.right),
    ['foo', 'bar'],
  )
  assert.ok(adds.every((r) => r.left === undefined))
})

test('lineDiff: all lines inserted (empty-string base) produces remove then adds', () => {
  // ''.split('\n') → [''] so the single empty line is a remove
  const rows = lineDiff('', 'first\nsecond')
  const removes = rows.filter((r) => r.type === 'remove')
  const adds = rows.filter((r) => r.type === 'add')
  assert.equal(removes.length, 1)
  assert.equal(removes[0].left, '')
  assert.equal(removes[0].right, undefined)
  assert.equal(adds.length, 2)
  assert.deepEqual(
    adds.map((r) => r.right),
    ['first', 'second'],
  )
})

// ── deletions only ────────────────────────────────────────────────────────────

test('lineDiff: single deletion in the middle produces correct same/remove rows', () => {
  const rows = lineDiff('a\nremoved\nb', 'a\nb')
  assert.equal(rows.length, 3)
  assert.equal(rows[0].type, 'same')
  assert.equal(rows[0].left, 'a')
  assert.equal(rows[1].type, 'remove')
  assert.equal(rows[1].left, 'removed')
  assert.equal(rows[1].right, undefined)
  assert.equal(rows[2].type, 'same')
  assert.equal(rows[2].left, 'b')
})

test('lineDiff: all lines deleted (empty-string target) produces removes then add', () => {
  // ''.split('\n') → [''] so the single empty line is an add
  const rows = lineDiff('first\nsecond', '')
  const removes = rows.filter((r) => r.type === 'remove')
  const adds = rows.filter((r) => r.type === 'add')
  assert.equal(removes.length, 2)
  assert.deepEqual(
    removes.map((r) => r.left),
    ['first', 'second'],
  )
  assert.ok(removes.every((r) => r.right === undefined))
  assert.equal(adds.length, 1)
  assert.equal(adds[0].right, '')
})

// ── mixed changes ─────────────────────────────────────────────────────────────

test('lineDiff: changed middle line preserves surrounding same rows', () => {
  const before = 'header\nold body\nfooter'
  const after = 'header\nnew body\nfooter'
  const rows = lineDiff(before, after)
  assert.equal(rows.length, 4)
  assert.equal(rows[0].type, 'same')
  assert.equal(rows[0].left, 'header')
  assert.equal(rows[0].right, 'header')
  assert.equal(rows[1].type, 'remove')
  assert.equal(rows[1].left, 'old body')
  assert.equal(rows[2].type, 'add')
  assert.equal(rows[2].right, 'new body')
  assert.equal(rows[3].type, 'same')
  assert.equal(rows[3].left, 'footer')
  assert.equal(rows[3].right, 'footer')
})

test('lineDiff: multiple separate changes interspersed with same rows', () => {
  const before = 'aaa\nbbb\nccc\nddd'
  const after = 'aaa\nBBB\nccc\nDDD'
  const rows = lineDiff(before, after)
  const sames = rows.filter((r) => r.type === 'same')
  const removes = rows.filter((r) => r.type === 'remove')
  const adds = rows.filter((r) => r.type === 'add')
  assert.equal(sames.length, 2)
  assert.equal(removes.length, 2)
  assert.equal(adds.length, 2)
  assert.deepEqual(
    sames.map((r) => r.left),
    ['aaa', 'ccc'],
  )
  assert.deepEqual(
    removes.map((r) => r.left),
    ['bbb', 'ddd'],
  )
  assert.deepEqual(
    adds.map((r) => r.right),
    ['BBB', 'DDD'],
  )
})

// ── empty-string edge cases ───────────────────────────────────────────────────

test('lineDiff: empty string vs empty string is one same row', () => {
  const rows = lineDiff('', '')
  assert.equal(rows.length, 1)
  assert.equal(rows[0].type, 'same')
  assert.equal(rows[0].left, '')
  assert.equal(rows[0].right, '')
})

test('lineDiff: trailing newline on both sides is two same rows', () => {
  // 'a\n'.split('\n') → ['a', '']
  const rows = lineDiff('a\n', 'a\n')
  assert.equal(rows.length, 2)
  assert.ok(rows.every((r) => r.type === 'same'))
  assert.equal(rows[0].left, 'a')
  assert.equal(rows[1].left, '')
})

test('lineDiff: adding a trailing newline surfaces as an add row for the empty string', () => {
  // Before: ['a'] — After: ['a', '']
  const rows = lineDiff('a', 'a\n')
  const sames = rows.filter((r) => r.type === 'same')
  const adds = rows.filter((r) => r.type === 'add')
  assert.equal(sames.length, 1)
  assert.equal(sames[0].left, 'a')
  assert.equal(adds.length, 1)
  assert.equal(adds[0].right, '')
  assert.equal(adds[0].left, undefined)
})

test('lineDiff: removing a trailing newline surfaces as a remove row for the empty string', () => {
  const rows = lineDiff('a\n', 'a')
  const sames = rows.filter((r) => r.type === 'same')
  const removes = rows.filter((r) => r.type === 'remove')
  assert.equal(sames.length, 1)
  assert.equal(sames[0].left, 'a')
  assert.equal(removes.length, 1)
  assert.equal(removes[0].left, '')
  assert.equal(removes[0].right, undefined)
})

test('lineDiff: single newline vs double newline differs by one add row', () => {
  // '\n' → ['', '']  '\n\n' → ['', '', '']
  const rows = lineDiff('\n', '\n\n')
  const adds = rows.filter((r) => r.type === 'add')
  const sames = rows.filter((r) => r.type === 'same')
  assert.equal(adds.length, 1)
  assert.equal(adds[0].right, '')
  assert.equal(sames.length, 2)
})

// ── field shape invariants ────────────────────────────────────────────────────

test('lineDiff: same rows always have both left and right fields', () => {
  const rows = lineDiff('one\ntwo\nthree', 'one\ntwo\nthree')
  const sameRows = rows.filter((r) => r.type === 'same')
  assert.ok(sameRows.length > 0)
  assert.ok(sameRows.every((r) => r.left !== undefined && r.right !== undefined))
})

test('lineDiff: remove rows have left but not right', () => {
  const rows = lineDiff('kept\nremoved', 'kept')
  const removes = rows.filter((r) => r.type === 'remove')
  assert.equal(removes.length, 1)
  assert.ok(removes.every((r) => r.left !== undefined && r.right === undefined))
})

test('lineDiff: add rows have right but not left', () => {
  const rows = lineDiff('kept', 'kept\nadded')
  const adds = rows.filter((r) => r.type === 'add')
  assert.equal(adds.length, 1)
  assert.ok(adds.every((r) => r.right !== undefined && r.left === undefined))
})
