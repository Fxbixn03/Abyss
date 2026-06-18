/**
 * Pure-logic tests for src/features/chats/lib/format.ts (node:test).
 * relativeTime, formatBytes, and formatCost are deterministic presentation
 * helpers with no disk access, IPC, or DOM dependencies.
 */

import { test } from 'node:test'
import assert from 'node:assert/strict'

import type { TFunction } from 'i18next'
import {
  relativeTime,
  formatBytes,
  formatCost,
} from '@/features/chats/lib/format'

// Minimal stub t: returns the key as-is so tests remain deterministic.
// Cast to TFunction<'chats'> since the stub does not need full type fidelity.
const stubT = ((key: string, opts?: { count?: number }) => {
  if (opts?.count !== undefined) return `${key}:${String(opts.count)}`
  return key
}) as unknown as TFunction<'chats'>

// ── relativeTime ──────────────────────────────────────────────────────────────

test('relativeTime: undefined input returns empty string', () => {
  assert.equal(relativeTime(undefined, stubT), '')
})

test('relativeTime: null input (cast) returns empty string', () => {
  // The type signature accepts undefined; pass null via cast to verify guard.
  assert.equal(relativeTime(null as unknown as string | undefined, stubT), '')
})

test('relativeTime: invalid ISO string returns empty string', () => {
  assert.equal(relativeTime('not-a-date', stubT), '')
})

test('relativeTime: timestamp less than 1 minute ago returns "just now"', () => {
  const iso = new Date(Date.now() - 10_000).toISOString() // 10 seconds ago
  assert.equal(relativeTime(iso, stubT), 'relativeTime.justNow')
})

test('relativeTime: a 45-minute-old timestamp returns minutesAgo key', () => {
  const iso = new Date(Date.now() - 45 * 60_000).toISOString()
  assert.equal(relativeTime(iso, stubT), 'relativeTime.minutesAgo:45')
})

test('relativeTime: a 5-hour-old timestamp returns hoursAgo key', () => {
  const iso = new Date(Date.now() - 5 * 60 * 60_000).toISOString()
  assert.equal(relativeTime(iso, stubT), 'relativeTime.hoursAgo:5')
})

test('relativeTime: a 3-day-old timestamp returns daysAgo key', () => {
  const iso = new Date(Date.now() - 3 * 24 * 60 * 60_000).toISOString()
  assert.equal(relativeTime(iso, stubT), 'relativeTime.daysAgo:3')
})

test('relativeTime: a timestamp older than 30 days returns a locale date string', () => {
  const oldDate = new Date(Date.now() - 31 * 24 * 60 * 60_000)
  const iso = oldDate.toISOString()
  const result = relativeTime(iso, stubT)
  // Must match what Date.toLocaleDateString() returns for the same date.
  assert.equal(result, oldDate.toLocaleDateString())
})

// ── formatBytes ───────────────────────────────────────────────────────────────

test('formatBytes: 0 bytes returns "0 B"', () => {
  assert.equal(formatBytes(0), '0 B')
})

test('formatBytes: 512 bytes returns "512 B"', () => {
  assert.equal(formatBytes(512), '512 B')
})

test('formatBytes: 1024 bytes returns "1 KB"', () => {
  assert.equal(formatBytes(1024), '1 KB')
})

test('formatBytes: 1.5 MB returns the ".1 MB" form', () => {
  // 1.5 * 1024 * 1024 = 1,572,864 bytes → "1.5 MB"
  assert.equal(formatBytes(1.5 * 1024 * 1024), '1.5 MB')
})

// ── formatCost ────────────────────────────────────────────────────────────────

test('formatCost: undefined returns empty string', () => {
  assert.equal(formatCost(undefined), '')
})

test('formatCost: a value below $0.01 uses 4 decimal places', () => {
  // $0.0050 → "$0.0050"
  assert.equal(formatCost(0.005), '$0.0050')
})

test('formatCost: a value of $0.50 uses 2 decimal places', () => {
  assert.equal(formatCost(0.5), '$0.50')
})
