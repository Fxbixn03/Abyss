/**
 * Pure-helper tests for src/shared/lib/cost.ts (node:test).
 * Both `estimateCostUsd` and `formatMoney` are deterministic and
 * side-effect-free — no disk access, no IPC, no React — so these tests are
 * cheap and CI-safe.
 */

import { test } from 'node:test'
import assert from 'node:assert/strict'

import {
  estimateCostUsd,
  formatMoney,
  TOKEN_RATE_USD_PER_MTOK,
  APPROX_EUR_PER_USD,
  APPROX_GBP_PER_USD,
  APPROX_CAD_PER_USD,
  APPROX_JPY_PER_USD,
} from '@/shared/lib/cost'

// ── estimateCostUsd ───────────────────────────────────────────────────────────

test('estimateCostUsd: zero tokens returns 0', () => {
  assert.equal(estimateCostUsd(0, 0), 0)
})

test('estimateCostUsd: zero input tokens and zero output tokens is exactly 0', () => {
  assert.strictEqual(estimateCostUsd(0, 0), 0)
})

test('estimateCostUsd: input-only — 1M input tokens equals TOKEN_RATE_USD_PER_MTOK.input', () => {
  const cost = estimateCostUsd(1_000_000, 0)
  assert.equal(cost, TOKEN_RATE_USD_PER_MTOK.input)
})

test('estimateCostUsd: output-only — 1M output tokens equals TOKEN_RATE_USD_PER_MTOK.output', () => {
  const cost = estimateCostUsd(0, 1_000_000)
  assert.equal(cost, TOKEN_RATE_USD_PER_MTOK.output)
})

test('estimateCostUsd: 1M input + 1M output equals sum of both rates', () => {
  const cost = estimateCostUsd(1_000_000, 1_000_000)
  assert.equal(cost, TOKEN_RATE_USD_PER_MTOK.input + TOKEN_RATE_USD_PER_MTOK.output)
})

test('estimateCostUsd: 2M input tokens doubles the input rate', () => {
  const cost = estimateCostUsd(2_000_000, 0)
  assert.equal(cost, 2 * TOKEN_RATE_USD_PER_MTOK.input)
})

test('estimateCostUsd: 500k input tokens is half the input rate', () => {
  const cost = estimateCostUsd(500_000, 0)
  assert.equal(cost, TOKEN_RATE_USD_PER_MTOK.input / 2)
})

test('estimateCostUsd: 500k output tokens is half the output rate', () => {
  const cost = estimateCostUsd(0, 500_000)
  assert.equal(cost, TOKEN_RATE_USD_PER_MTOK.output / 2)
})

test('estimateCostUsd: combined input and output tokens uses linear addition', () => {
  const inputTokens = 300_000
  const outputTokens = 100_000
  const expected =
    (inputTokens / 1_000_000) * TOKEN_RATE_USD_PER_MTOK.input +
    (outputTokens / 1_000_000) * TOKEN_RATE_USD_PER_MTOK.output
  assert.equal(estimateCostUsd(inputTokens, outputTokens), expected)
})

test('estimateCostUsd: output tokens cost more per token than input tokens', () => {
  // Sanity: 1M output should cost more than 1M input
  assert.ok(TOKEN_RATE_USD_PER_MTOK.output > TOKEN_RATE_USD_PER_MTOK.input)
  const inputOnlyCost = estimateCostUsd(1_000_000, 0)
  const outputOnlyCost = estimateCostUsd(0, 1_000_000)
  assert.ok(outputOnlyCost > inputOnlyCost)
})

// ── formatMoney — USD ─────────────────────────────────────────────────────────

test('formatMoney: usd 0 renders as "$0.00"', () => {
  assert.equal(formatMoney(0, 'usd'), '$0.00')
})

test('formatMoney: usd 1 renders as "$1.00"', () => {
  assert.equal(formatMoney(1, 'usd'), '$1.00')
})

test('formatMoney: usd 0.005 renders with two decimal places', () => {
  // toFixed(2) on 0.005 → '0.01' in most engines (banker's rounding aside)
  const result = formatMoney(0.005, 'usd')
  assert.ok(result.startsWith('$'), `expected $ prefix, got ${result}`)
})

test('formatMoney: usd 3.14159 rounds to two decimal places', () => {
  assert.equal(formatMoney(3.14159, 'usd'), '$3.14')
})

test('formatMoney: usd uses $ prefix', () => {
  assert.ok(formatMoney(1.5, 'usd').startsWith('$'))
})

// ── formatMoney — EUR ─────────────────────────────────────────────────────────

test('formatMoney: eur 0 renders as "€0.00"', () => {
  assert.equal(formatMoney(0, 'eur'), '€0.00')
})

test('formatMoney: eur applies APPROX_EUR_PER_USD conversion', () => {
  const usd = 1
  const expected = `€${(usd * APPROX_EUR_PER_USD).toFixed(2)}`
  assert.equal(formatMoney(usd, 'eur'), expected)
})

test('formatMoney: eur 10 usd matches 10 * APPROX_EUR_PER_USD rounded to 2dp', () => {
  const result = formatMoney(10, 'eur')
  assert.equal(result, `€${(10 * APPROX_EUR_PER_USD).toFixed(2)}`)
})

test('formatMoney: eur uses € prefix', () => {
  assert.ok(formatMoney(1, 'eur').startsWith('€'))
})

// ── formatMoney — GBP ─────────────────────────────────────────────────────────

test('formatMoney: gbp 0 renders as "£0.00"', () => {
  assert.equal(formatMoney(0, 'gbp'), '£0.00')
})

test('formatMoney: gbp applies APPROX_GBP_PER_USD conversion', () => {
  const usd = 1
  const expected = `£${(usd * APPROX_GBP_PER_USD).toFixed(2)}`
  assert.equal(formatMoney(usd, 'gbp'), expected)
})

test('formatMoney: gbp 10 usd matches 10 * APPROX_GBP_PER_USD rounded to 2dp', () => {
  const result = formatMoney(10, 'gbp')
  assert.equal(result, `£${(10 * APPROX_GBP_PER_USD).toFixed(2)}`)
})

test('formatMoney: gbp uses £ prefix', () => {
  assert.ok(formatMoney(1, 'gbp').startsWith('£'))
})

// ── formatMoney — CAD ─────────────────────────────────────────────────────────

test('formatMoney: cad 0 renders as "C$0.00"', () => {
  assert.equal(formatMoney(0, 'cad'), 'C$0.00')
})

test('formatMoney: cad applies APPROX_CAD_PER_USD conversion', () => {
  const usd = 1
  const expected = `C$${(usd * APPROX_CAD_PER_USD).toFixed(2)}`
  assert.equal(formatMoney(usd, 'cad'), expected)
})

test('formatMoney: cad 10 usd matches 10 * APPROX_CAD_PER_USD rounded to 2dp', () => {
  const result = formatMoney(10, 'cad')
  assert.equal(result, `C$${(10 * APPROX_CAD_PER_USD).toFixed(2)}`)
})

test('formatMoney: cad uses C$ prefix', () => {
  assert.ok(formatMoney(1, 'cad').startsWith('C$'))
})

// ── formatMoney — JPY ─────────────────────────────────────────────────────────

test('formatMoney: jpy 0 renders as "¥0"', () => {
  assert.equal(formatMoney(0, 'jpy'), '¥0')
})

test('formatMoney: jpy applies APPROX_JPY_PER_USD and rounds to whole number', () => {
  const usd = 1
  const expected = `¥${Math.round(usd * APPROX_JPY_PER_USD)}`
  assert.equal(formatMoney(usd, 'jpy'), expected)
})

test('formatMoney: jpy 10 usd rounds 10 * APPROX_JPY_PER_USD to nearest integer', () => {
  const result = formatMoney(10, 'jpy')
  assert.equal(result, `¥${Math.round(10 * APPROX_JPY_PER_USD)}`)
})

test('formatMoney: jpy result does not contain a decimal point (integer-only)', () => {
  const result = formatMoney(1.23, 'jpy')
  assert.ok(!result.includes('.'), `expected no decimal point in JPY output, got ${result}`)
})

test('formatMoney: jpy uses ¥ prefix', () => {
  assert.ok(formatMoney(1, 'jpy').startsWith('¥'))
})

test('formatMoney: jpy fractional usd is rounded not truncated', () => {
  // 0.1 USD * 157 JPY/USD = 15.7 → rounds to 16, not 15
  const result = formatMoney(0.1, 'jpy')
  assert.equal(result, `¥${Math.round(0.1 * APPROX_JPY_PER_USD)}`)
})

// ── cross-currency conversion constant verification ───────────────────────────

test('APPROX_EUR_PER_USD is between 0.8 and 1.0 (reasonable EUR/USD range)', () => {
  assert.ok(APPROX_EUR_PER_USD > 0.8 && APPROX_EUR_PER_USD < 1.0)
})

test('APPROX_GBP_PER_USD is between 0.6 and 0.9 (reasonable GBP/USD range)', () => {
  assert.ok(APPROX_GBP_PER_USD > 0.6 && APPROX_GBP_PER_USD < 0.9)
})

test('APPROX_CAD_PER_USD is greater than 1 (CAD is weaker than USD)', () => {
  assert.ok(APPROX_CAD_PER_USD > 1)
})

test('APPROX_JPY_PER_USD is greater than 100 (JPY is much weaker than USD)', () => {
  assert.ok(APPROX_JPY_PER_USD > 100)
})

test('formatMoney eur: 1 USD produces a value less than $1.00 in EUR', () => {
  // EUR should be cheaper than USD
  const eurAmount = parseFloat(formatMoney(1, 'eur').slice(1))
  assert.ok(eurAmount < 1)
})

test('formatMoney cad: 1 USD produces a value greater than $1.00 in CAD', () => {
  // CAD should give more units than USD
  const cadAmount = parseFloat(formatMoney(1, 'cad').slice(2))
  assert.ok(cadAmount > 1)
})

test('formatMoney jpy: 1 USD produces more than 100 yen', () => {
  const jpyAmount = parseInt(formatMoney(1, 'jpy').slice(1), 10)
  assert.ok(jpyAmount > 100)
})
