/**
 * Pure-logic tests for src/features/chats/lib/format.ts (node:test).
 * relativeTime, formatBytes, and formatCost are deterministic presentation
 * helpers with no disk access, IPC, or DOM dependencies.
 */

import { test } from 'node:test'
import assert from 'node:assert/strict'

import {
  relativeTime,
  formatBytes,
  formatCost,
} from '@/features/chats/lib/format'

// ── relativeTime ──────────────────────────────────────────────────────────────

test('relativeTime: undefined input returns empty string', () => {
  assert.equal(relativeTime(undefined), '')
})

test('relativeTime: null input (cast) returns empty string', () => {
  // The type signature accepts undefined; pass null via cast to verify guard.
  assert.equal(relativeTime(null as unknown as string | undefined), '')
})

test('relativeTime: invalid ISO string returns empty string', () => {
  assert.equal(relativeTime('not-a-date'), '')
})

test('relativeTime: timestamp less than 1 minute ago returns "just now"', () => {
  const iso = new Date(Date.now() - 10_000).toISOString() // 10 seconds ago
  assert.equal(relativeTime(iso), 'just now')
})

test('relativeTime: a 45-minute-old timestamp returns "45m ago"', () => {
  const iso = new Date(Date.now() - 45 * 60_000).toISOString()
  assert.equal(relativeTime(iso), '45m ago')
})

test('relativeTime: a 5-hour-old timestamp returns "5h ago"', () => {
  const iso = new Date(Date.now() - 5 * 60 * 60_000).toISOString()
  assert.equal(relativeTime(iso), '5h ago')
})

test('relativeTime: a 3-day-old timestamp returns "3d ago"', () => {
  const iso = new Date(Date.now() - 3 * 24 * 60 * 60_000).toISOString()
  assert.equal(relativeTime(iso), '3d ago')
})

test('relativeTime: a timestamp older than 30 days returns a locale date string', () => {
  const oldDate = new Date(Date.now() - 31 * 24 * 60 * 60_000)
  const iso = oldDate.toISOString()
  const result = relativeTime(iso)
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
