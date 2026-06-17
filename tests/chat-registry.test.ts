/**
 * Tests for `core/chat/registry.ts` — the central chat-runtime registry.
 *
 * Covers the three public exports:
 *   1. `hasChatRuntime`  — returns false for unknown ids, true for built-ins
 *   2. `getChatRuntime`  — throws a typed Error for unknown ids, returns the
 *                          correct runtime object for a known id
 *   3. `listChatRuntimeIds` — includes all well-known built-in agent ids
 *
 * All tests are synchronous and require no filesystem access.
 */

import { test } from 'node:test'
import assert from 'node:assert/strict'

import {
  hasChatRuntime,
  getChatRuntime,
  listChatRuntimeIds,
} from '@core/chat/registry'

// ── hasChatRuntime: unknown id ────────────────────────────────────────────────

test('hasChatRuntime: returns false for an unregistered agent id', () => {
  // Assertion 1
  assert.equal(hasChatRuntime('unknown-agent'), false)
})

test('hasChatRuntime: does not throw for an unregistered agent id', () => {
  // Assertion 2: calling hasChatRuntime with an unknown id must not throw
  assert.doesNotThrow(() => hasChatRuntime('unknown-agent'))
})

// ── getChatRuntime: unknown id throws ─────────────────────────────────────────

test('getChatRuntime: throws Error for an unregistered agent id', () => {
  // Assertion 3
  assert.throws(
    () => getChatRuntime('unknown-agent'),
    (err: unknown) => err instanceof Error,
  )
})

test('getChatRuntime: error message matches expected text for unregistered id', () => {
  // Assertion 4
  assert.throws(
    () => getChatRuntime('unknown-agent'),
    (err: unknown) => {
      assert.ok(err instanceof Error)
      assert.equal(
        err.message,
        'No chat runtime registered for agent: unknown-agent',
      )
      return true
    },
  )
})

// ── hasChatRuntime: well-known built-in ids ───────────────────────────────────

test('hasChatRuntime: returns true for the built-in "claude" agent', () => {
  // Assertion 5
  assert.equal(hasChatRuntime('claude'), true)
})

test('hasChatRuntime: returns true for the built-in "codex" agent', () => {
  // Assertion 6
  assert.equal(hasChatRuntime('codex'), true)
})

test('hasChatRuntime: returns true for the built-in "gemini" agent', () => {
  // Assertion 7
  assert.equal(hasChatRuntime('gemini'), true)
})

// ── listChatRuntimeIds ────────────────────────────────────────────────────────

test('listChatRuntimeIds: returns an array that includes "claude", "codex", and "gemini"', () => {
  const ids = listChatRuntimeIds()

  // Assertion 8: result is an array
  assert.ok(Array.isArray(ids))

  // Assertion 9: includes claude
  assert.ok(ids.includes('claude'), `Expected ids to include 'claude', got: ${JSON.stringify(ids)}`)

  // Assertion 10: includes codex
  assert.ok(ids.includes('codex'), `Expected ids to include 'codex', got: ${JSON.stringify(ids)}`)

  // Assertion 11: includes gemini
  assert.ok(ids.includes('gemini'), `Expected ids to include 'gemini', got: ${JSON.stringify(ids)}`)
})

// ── getChatRuntime: correct object for known id ───────────────────────────────

test('getChatRuntime("claude").agentId equals "claude"', () => {
  const runtime = getChatRuntime('claude')

  // Assertion 12: agentId property matches the requested id
  assert.equal(runtime.agentId, 'claude')
})
