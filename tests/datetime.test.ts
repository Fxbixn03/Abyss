/**
 * Pure-logic tests for src/shared/lib/datetime.ts (node:test).
 * formatDateTime is deterministic and has no DOM, IPC, or React deps.
 */

import { test } from 'node:test'
import assert from 'node:assert/strict'

import { formatDateTime } from '@/shared/lib/datetime'

// Use a fixed timestamp that has non-trivial values for all fields:
// 2024-03-05 09:07 local time — single-digit month, day, hour, minute
// to exercise zero-padding.
// We build the Date directly to avoid timezone ambiguity.
const Y = 2024
const MO = 3 // March (1-based)
const D = 5
const H = 9
const MIN = 7

// Construct the Date in local time so that the padded fields are predictable.
const fixedDate = new Date(Y, MO - 1, D, H, MIN, 0, 0)

const isoExpected = `${Y}-0${MO}-0${D} 0${H}:0${MIN}`
const usExpected = `0${MO}/0${D}/${Y} 0${H}:0${MIN}`
const euExpected = `0${D}.0${MO}.${Y} 0${H}:0${MIN}`

// ── iso format ────────────────────────────────────────────────────────────────

test('formatDateTime: iso format produces YYYY-MM-DD HH:mm with zero-padded fields', () => {
  const result = formatDateTime(fixedDate, 'iso')
  assert.equal(result, isoExpected)
})

test('formatDateTime: iso format — month and day are zero-padded', () => {
  // Month 3 → '03', Day 5 → '05'
  assert.ok(result_iso().includes('-03-'), 'Expected zero-padded month "-03-"')
  assert.ok(result_iso().includes('-05 '), 'Expected zero-padded day "-05 "')
})

function result_iso(): string {
  return formatDateTime(fixedDate, 'iso')
}

// ── us format ─────────────────────────────────────────────────────────────────

test('formatDateTime: us format produces MM/DD/YYYY HH:mm', () => {
  const result = formatDateTime(fixedDate, 'us')
  assert.equal(result, usExpected)
})

test('formatDateTime: us format — month and day are zero-padded', () => {
  const result = formatDateTime(fixedDate, 'us')
  assert.ok(result.startsWith('03/'), 'Expected zero-padded month "03/"')
  assert.ok(result.includes('/05/'), 'Expected zero-padded day "/05/"')
})

// ── eu format ─────────────────────────────────────────────────────────────────

test('formatDateTime: eu format produces DD.MM.YYYY HH:mm', () => {
  const result = formatDateTime(fixedDate, 'eu')
  assert.equal(result, euExpected)
})

test('formatDateTime: eu format — day comes first, then month', () => {
  const result = formatDateTime(fixedDate, 'eu')
  assert.ok(result.startsWith('05.'), 'Expected zero-padded day "05." at start')
  assert.ok(result.includes('.03.'), 'Expected zero-padded month ".03."')
})

// ── locale format (default) ───────────────────────────────────────────────────

test('formatDateTime: locale format returns a non-empty string', () => {
  const result = formatDateTime(fixedDate, 'locale')
  assert.equal(typeof result, 'string')
  assert.ok(result.length > 0, 'Expected a non-empty locale string')
})

test('formatDateTime: default format (no second arg) returns a non-empty string', () => {
  const result = formatDateTime(fixedDate)
  assert.equal(typeof result, 'string')
  assert.ok(result.length > 0, 'Expected a non-empty string for default format')
})

// ── Date object input ─────────────────────────────────────────────────────────

test('formatDateTime: passing a Date object produces the same result as an equivalent ISO string', () => {
  // Build an ISO string from fixedDate in a timezone-safe way by using the
  // iso formatter itself — both code paths share the same Date construction.
  const fromDate = formatDateTime(fixedDate, 'iso')
  // Reconstruct via the toISOString round-trip only for the Date-vs-string comparison.
  // We compare Date directly vs new Date(isoString) for the same local wall-clock.
  const equivalentString = fixedDate.toISOString()
  const fromString = formatDateTime(equivalentString, 'iso')
  assert.equal(fromDate, fromString)
})

// ── numeric Unix timestamp ────────────────────────────────────────────────────

test('formatDateTime: passing a numeric Unix timestamp (ms) works', () => {
  const ms = fixedDate.getTime()
  const result = formatDateTime(ms, 'iso')
  assert.equal(result, isoExpected)
})

test('formatDateTime: numeric timestamp produces the same result as the equivalent Date object', () => {
  const ms = fixedDate.getTime()
  assert.equal(formatDateTime(ms, 'us'), formatDateTime(fixedDate, 'us'))
  assert.equal(formatDateTime(ms, 'eu'), formatDateTime(fixedDate, 'eu'))
})

// ── invalid input ─────────────────────────────────────────────────────────────

test('formatDateTime: an invalid date string returns empty string', () => {
  assert.equal(formatDateTime('not-a-date', 'iso'), '')
  assert.equal(formatDateTime('not-a-date', 'us'), '')
  assert.equal(formatDateTime('not-a-date', 'eu'), '')
  assert.equal(formatDateTime('not-a-date', 'locale'), '')
})

test('formatDateTime: completely empty string is an invalid date and returns empty string', () => {
  // new Date('') produces an Invalid Date in all JS engines
  assert.equal(formatDateTime('', 'iso'), '')
})
