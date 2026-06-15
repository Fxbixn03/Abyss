/**
 * Pure-helper tests for src/features/context/lib/tokens.ts (node:test).
 * Both functions are deterministic and side-effect-free — no disk access,
 * no process spawning, so these tests are cheap and CI-safe.
 */

import { test } from 'node:test'
import assert from 'node:assert/strict'

import { estimateTokens, formatTokens } from '@/features/context/lib/tokens'

// ── estimateTokens ────────────────────────────────────────────────────────────

test('estimateTokens: empty string returns 0', () => {
  assert.equal(estimateTokens(''), 0)
})

test('estimateTokens: four characters returns 1 (exact boundary)', () => {
  assert.equal(estimateTokens('abcd'), 1)
})

test('estimateTokens: five characters returns 2 (ceil(5/4) = 2)', () => {
  assert.equal(estimateTokens('abcde'), 2)
})

test('estimateTokens: three characters returns 1 (ceil(3/4) = 1)', () => {
  assert.equal(estimateTokens('abc'), 1)
})

test('estimateTokens: one character returns 1 (ceil(1/4) = 1)', () => {
  assert.equal(estimateTokens('a'), 1)
})

test('estimateTokens: eight characters returns 2 (ceil(8/4) = 2)', () => {
  assert.equal(estimateTokens('abcdefgh'), 2)
})

test('estimateTokens: nine characters returns 3 (ceil(9/4) = 3)', () => {
  assert.equal(estimateTokens('abcdefghi'), 3)
})

test('estimateTokens: 400 characters returns 100 (ceil(400/4) = 100)', () => {
  const text = 'a'.repeat(400)
  assert.equal(estimateTokens(text), 100)
})

test('estimateTokens: 401 characters returns 101 (ceil(401/4) = 101)', () => {
  const text = 'a'.repeat(401)
  assert.equal(estimateTokens(text), 101)
})

test('estimateTokens: uses Math.ceil — never rounds down', () => {
  // ceil(1/4)=1, ceil(2/4)=1, ceil(3/4)=1, ceil(4/4)=1
  for (let len = 1; len <= 4; len++) {
    assert.equal(estimateTokens('x'.repeat(len)), 1)
  }
})

// ── formatTokens ──────────────────────────────────────────────────────────────

test('formatTokens: 0 returns "0" (plain digits below 1000)', () => {
  assert.equal(formatTokens(0), '0')
})

test('formatTokens: 1 returns "1" (plain digits below 1000)', () => {
  assert.equal(formatTokens(1), '1')
})

test('formatTokens: 999 returns "999" (plain digits — just below 1000)', () => {
  assert.equal(formatTokens(999), '999')
})

test('formatTokens: 1000 returns "1.0k" (k suffix starts at 1000)', () => {
  assert.equal(formatTokens(1000), '1.0k')
})

test('formatTokens: 1500 returns "1.5k" (one decimal place)', () => {
  assert.equal(formatTokens(1500), '1.5k')
})

test('formatTokens: 10000 returns "10.0k"', () => {
  assert.equal(formatTokens(10000), '10.0k')
})

test('formatTokens: 123456 returns "123.5k" (rounded to one decimal)', () => {
  assert.equal(formatTokens(123456), '123.5k')
})

test('formatTokens: 500 returns "500" (plain digits, not k)', () => {
  assert.equal(formatTokens(500), '500')
})

test('formatTokens: 2000 returns "2.0k"', () => {
  assert.equal(formatTokens(2000), '2.0k')
})
