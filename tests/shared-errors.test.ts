/**
 * Pure-logic tests for src/shared/lib/errors.ts (node:test).
 *
 * Only the classifier and marker helpers are exercised here — they have no
 * DOM, React, or IPC side-effects (the toast-presenting helpers are not
 * tested because they require a live DOM). sonner loads fine in Node.js
 * without crashing (it guards against a missing document), so the module can
 * be imported directly.
 */

import { test } from 'node:test'
import assert from 'node:assert/strict'

import {
  getErrorMessage,
  isErrorReported,
  markErrorReported,
  isConfigParseError,
  isConfigValidationError,
  isWritePermissionError,
  isReadPermissionError,
  isDiskWriteError,
  isNotFoundError,
  isPathScopeError,
} from '@/shared/lib/errors'
import { IpcError, IpcErrorCode } from '@/shared/ipc/ipc-error'

// ── getErrorMessage ───────────────────────────────────────────────────────────

test('getErrorMessage: returns err.message for an Error instance', () => {
  assert.equal(getErrorMessage(new Error('something broke')), 'something broke')
})

test('getErrorMessage: returns the string itself for a plain string', () => {
  assert.equal(getErrorMessage('plain string error'), 'plain string error')
})

test('getErrorMessage: returns the fallback message for a number', () => {
  assert.equal(getErrorMessage(42), 'Something went wrong.')
})

test('getErrorMessage: returns the fallback message for null', () => {
  assert.equal(getErrorMessage(null), 'Something went wrong.')
})

test('getErrorMessage: returns the fallback message for undefined', () => {
  assert.equal(getErrorMessage(undefined), 'Something went wrong.')
})

test('getErrorMessage: returns the fallback message for a plain object', () => {
  assert.equal(getErrorMessage({ code: 'X' }), 'Something went wrong.')
})

// ── isErrorReported / markErrorReported ───────────────────────────────────────

test('isErrorReported: returns false for a fresh Error', () => {
  const err = new Error('fresh')
  assert.equal(isErrorReported(err), false)
})

test('isErrorReported: returns true after markErrorReported has been called', () => {
  const err = new Error('to report')
  markErrorReported(err)
  assert.equal(isErrorReported(err), true)
})

test('markErrorReported: is idempotent (calling twice still returns true)', () => {
  const err = new Error('idempotent')
  markErrorReported(err)
  markErrorReported(err)
  assert.equal(isErrorReported(err), true)
})

test('isErrorReported: returns false for a string (not an object)', () => {
  assert.equal(isErrorReported('not an object'), false)
})

test('isErrorReported: returns false for null', () => {
  assert.equal(isErrorReported(null), false)
})

test('markErrorReported: silently ignores non-object values (string)', () => {
  // Should not throw — marking a non-object is a no-op.
  assert.doesNotThrow(() => markErrorReported('a string'))
})

test('markErrorReported: silently ignores null', () => {
  assert.doesNotThrow(() => markErrorReported(null))
})

// ── classifier helpers ────────────────────────────────────────────────────────
// Each classifier is tested with:
//   (a) an IpcError with the matching code  → true
//   (b) an IpcError with a different code   → false
//   (c) a plain Error                       → false
//   (d) null                                → false

function makeIpcError(code: string): IpcError {
  return new IpcError({ code, message: 'test error' })
}

// ── isConfigParseError ────────────────────────────────────────────────────────

test('isConfigParseError: true for IpcError with ConfigParse code', () => {
  assert.equal(isConfigParseError(makeIpcError(IpcErrorCode.ConfigParse)), true)
})

test('isConfigParseError: false for IpcError with a different code', () => {
  assert.equal(isConfigParseError(makeIpcError(IpcErrorCode.DiskFull)), false)
})

test('isConfigParseError: false for a plain Error', () => {
  assert.equal(isConfigParseError(new Error('parse failed')), false)
})

test('isConfigParseError: false for null', () => {
  assert.equal(isConfigParseError(null), false)
})

// ── isConfigValidationError ───────────────────────────────────────────────────

test('isConfigValidationError: true for IpcError with ConfigInvalid code', () => {
  assert.equal(isConfigValidationError(makeIpcError(IpcErrorCode.ConfigInvalid)), true)
})

test('isConfigValidationError: false for IpcError with a different code', () => {
  assert.equal(isConfigValidationError(makeIpcError(IpcErrorCode.ConfigParse)), false)
})

test('isConfigValidationError: false for a plain Error', () => {
  assert.equal(isConfigValidationError(new Error('invalid')), false)
})

test('isConfigValidationError: false for null', () => {
  assert.equal(isConfigValidationError(null), false)
})

// ── isWritePermissionError ────────────────────────────────────────────────────

test('isWritePermissionError: true for IpcError with WritePermission code', () => {
  assert.equal(isWritePermissionError(makeIpcError(IpcErrorCode.WritePermission)), true)
})

test('isWritePermissionError: false for IpcError with a different code', () => {
  assert.equal(isWritePermissionError(makeIpcError(IpcErrorCode.ReadPermission)), false)
})

test('isWritePermissionError: false for a plain Error', () => {
  assert.equal(isWritePermissionError(new Error('EACCES')), false)
})

test('isWritePermissionError: false for null', () => {
  assert.equal(isWritePermissionError(null), false)
})

// ── isReadPermissionError ─────────────────────────────────────────────────────

test('isReadPermissionError: true for IpcError with ReadPermission code', () => {
  assert.equal(isReadPermissionError(makeIpcError(IpcErrorCode.ReadPermission)), true)
})

test('isReadPermissionError: false for IpcError with a different code', () => {
  assert.equal(isReadPermissionError(makeIpcError(IpcErrorCode.WritePermission)), false)
})

test('isReadPermissionError: false for a plain Error', () => {
  assert.equal(isReadPermissionError(new Error('EACCES reading')), false)
})

test('isReadPermissionError: false for null', () => {
  assert.equal(isReadPermissionError(null), false)
})

// ── isDiskWriteError ──────────────────────────────────────────────────────────

test('isDiskWriteError: true for IpcError with DiskFull code', () => {
  assert.equal(isDiskWriteError(makeIpcError(IpcErrorCode.DiskFull)), true)
})

test('isDiskWriteError: false for IpcError with a different code', () => {
  assert.equal(isDiskWriteError(makeIpcError(IpcErrorCode.NotFound)), false)
})

test('isDiskWriteError: false for a plain Error', () => {
  assert.equal(isDiskWriteError(new Error('ENOSPC')), false)
})

test('isDiskWriteError: false for null', () => {
  assert.equal(isDiskWriteError(null), false)
})

// ── isNotFoundError ───────────────────────────────────────────────────────────

test('isNotFoundError: true for IpcError with NotFound code', () => {
  assert.equal(isNotFoundError(makeIpcError(IpcErrorCode.NotFound)), true)
})

test('isNotFoundError: false for IpcError with a different code', () => {
  assert.equal(isNotFoundError(makeIpcError(IpcErrorCode.DiskFull)), false)
})

test('isNotFoundError: false for a plain Error', () => {
  assert.equal(isNotFoundError(new Error('ENOENT')), false)
})

test('isNotFoundError: false for null', () => {
  assert.equal(isNotFoundError(null), false)
})

// ── isPathScopeError ──────────────────────────────────────────────────────────

test('isPathScopeError: true for IpcError with PathScope code', () => {
  assert.equal(isPathScopeError(makeIpcError(IpcErrorCode.PathScope)), true)
})

test('isPathScopeError: false for IpcError with a different code', () => {
  assert.equal(isPathScopeError(makeIpcError(IpcErrorCode.ConfigParse)), false)
})

test('isPathScopeError: false for a plain Error', () => {
  assert.equal(isPathScopeError(new Error('path escaped')), false)
})

test('isPathScopeError: false for null', () => {
  assert.equal(isPathScopeError(null), false)
})
