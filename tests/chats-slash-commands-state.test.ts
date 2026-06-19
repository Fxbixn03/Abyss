/**
 * Pure-logic tests for getSlashState from src/features/chats/lib/slashCommands.ts.
 * No DOM, IPC, or React dependencies.
 */

import { test } from 'node:test'
import assert from 'node:assert/strict'

import { getSlashState } from '@/features/chats/lib/slashCommands'

test('getSlashState: empty string → closed, empty query', () => {
  const result = getSlashState('')
  assert.equal(result.open, false)
  assert.equal(result.query, '')
})

test('getSlashState: "/" alone → open, query is empty string', () => {
  const result = getSlashState('/')
  assert.equal(result.open, true)
  assert.equal(result.query, '')
})

test('getSlashState: "/cl" → open, query is "cl"', () => {
  const result = getSlashState('/cl')
  assert.equal(result.open, true)
  assert.equal(result.query, 'cl')
})

test('getSlashState: "/clear something" (with space) → closed, argument mode', () => {
  const result = getSlashState('/clear something')
  assert.equal(result.open, false)
  assert.equal(result.query, '')
})

test('getSlashState: "hello" (no leading slash) → closed', () => {
  const result = getSlashState('hello')
  assert.equal(result.open, false)
  assert.equal(result.query, '')
})

test('getSlashState: "/ " (slash + space, no command) → closed', () => {
  const result = getSlashState('/ ')
  assert.equal(result.open, false)
  assert.equal(result.query, '')
})
