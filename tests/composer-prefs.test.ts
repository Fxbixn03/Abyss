/**
 * Pure-logic tests for getComposerPrefs in
 * src/features/chats/store/composerPrefs.store.ts (node:test).
 *
 * getComposerPrefs is a stateless helper — no DOM, IPC, React, or Zustand
 * dependencies are exercised here.
 */

import { test } from 'node:test'
import assert from 'node:assert/strict'

import {
  getComposerPrefs,
  type ComposerPrefs,
} from '@/features/chats/store/composerPrefs.store'

// ── DEFAULT_PREFS fallback ─────────────────────────────────────────────────────

test('getComposerPrefs: returns default prefs when the key is absent from an empty map', () => {
  const result = getComposerPrefs({}, 'sess-missing')
  assert.deepEqual(result, { model: 'default', permissionMode: 'default' })
})

test('getComposerPrefs: returns default prefs when the key is absent from a non-empty map', () => {
  const stored: ComposerPrefs = { model: 'claude-opus-4', permissionMode: 'acceptEdits' }
  const result = getComposerPrefs({ 'sess-1': stored }, 'sess-missing')
  assert.deepEqual(result, { model: 'default', permissionMode: 'default' })
})

// ── Stored value lookup ────────────────────────────────────────────────────────

test('getComposerPrefs: returns the stored value when the key is present', () => {
  const stored: ComposerPrefs = { model: 'claude-opus-4', permissionMode: 'acceptEdits' }
  const result = getComposerPrefs({ 'sess-1': stored }, 'sess-1')
  assert.deepEqual(result, { model: 'claude-opus-4', permissionMode: 'acceptEdits' })
})

test('getComposerPrefs: returns the value for the matching key and not a different key', () => {
  const stored1: ComposerPrefs = { model: 'claude-opus-4', permissionMode: 'acceptEdits' }
  const stored2: ComposerPrefs = { model: 'claude-sonnet-4', permissionMode: 'bypassPermissions' }
  const prefs = { 'sess-1': stored1, 'sess-2': stored2 }

  const result1 = getComposerPrefs(prefs, 'sess-1')
  const result2 = getComposerPrefs(prefs, 'sess-2')

  assert.deepEqual(result1, { model: 'claude-opus-4', permissionMode: 'acceptEdits' })
  assert.deepEqual(result2, { model: 'claude-sonnet-4', permissionMode: 'bypassPermissions' })
})

// ── Reference identity ────────────────────────────────────────────────────────

test('getComposerPrefs: returns the exact stored reference when the key exists (no unintended copying)', () => {
  const stored: ComposerPrefs = { model: 'claude-opus-4', permissionMode: 'acceptEdits' }
  const result = getComposerPrefs({ 'sess-1': stored }, 'sess-1')
  assert.equal(result, stored, 'Expected the exact same object reference to be returned')
})

// ── Edge cases ────────────────────────────────────────────────────────────────

test('getComposerPrefs: "new" key returns stored value when present', () => {
  const stored: ComposerPrefs = { model: 'claude-sonnet-4', permissionMode: 'default' }
  const result = getComposerPrefs({ new: stored }, 'new')
  assert.deepEqual(result, { model: 'claude-sonnet-4', permissionMode: 'default' })
})

test('getComposerPrefs: "new" key returns default prefs when absent', () => {
  const result = getComposerPrefs({}, 'new')
  assert.deepEqual(result, { model: 'default', permissionMode: 'default' })
})

test('getComposerPrefs: default prefs have model "default"', () => {
  const result = getComposerPrefs({}, 'any-key')
  assert.equal(result.model, 'default')
})

test('getComposerPrefs: default prefs have permissionMode "default"', () => {
  const result = getComposerPrefs({}, 'any-key')
  assert.equal(result.permissionMode, 'default')
})
