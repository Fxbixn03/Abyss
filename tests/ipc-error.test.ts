/**
 * Pure-logic tests for src/shared/ipc/ipc-error.ts (node:test).
 * normalizeError, encodeIpcError, and decodeIpcError have no DOM, IPC, or
 * React dependencies — they can be imported and exercised directly.
 */

import { test } from 'node:test'
import assert from 'node:assert/strict'

import {
  IpcError,
  IpcErrorCode,
  normalizeError,
  encodeIpcError,
  decodeIpcError,
} from '@/shared/ipc/ipc-error'

// ── normalizeError ────────────────────────────────────────────────────────────

test('normalizeError: preserves code and message from an error-like object', () => {
  const err = { code: IpcErrorCode.ConfigParse, message: 'bad JSON' }
  const result = normalizeError(err)
  assert.equal(result.code, IpcErrorCode.ConfigParse)
  assert.equal(result.message, 'bad JSON')
})

test('normalizeError: preserves filePath detail when present on the object', () => {
  const err = {
    code: IpcErrorCode.WritePermission,
    message: 'EACCES',
    filePath: '/etc/hosts',
  }
  const result = normalizeError(err)
  assert.equal(result.details?.filePath, '/etc/hosts')
})

test('normalizeError: falls back to IpcErrorCode.Unknown when object has no code', () => {
  const result = normalizeError({ message: 'oops' })
  assert.equal(result.code, IpcErrorCode.Unknown)
})

test('normalizeError: falls back to IpcErrorCode.Unknown for a plain string', () => {
  const result = normalizeError('something went wrong')
  assert.equal(result.code, IpcErrorCode.Unknown)
  assert.equal(result.message, 'something went wrong')
})

test('normalizeError: falls back to IpcErrorCode.Unknown for null', () => {
  const result = normalizeError(null)
  assert.equal(result.code, IpcErrorCode.Unknown)
})

test('normalizeError: falls back to IpcErrorCode.Unknown for a number', () => {
  const result = normalizeError(42)
  assert.equal(result.code, IpcErrorCode.Unknown)
})

test('normalizeError: merges details object when present', () => {
  const err = {
    code: IpcErrorCode.ConfigInvalid,
    message: 'Schema mismatch',
    details: { field: 'model', filePath: '/home/user/.claude.json' },
  }
  const result = normalizeError(err)
  assert.equal(result.details?.field, 'model')
  assert.equal(result.details?.filePath, '/home/user/.claude.json')
})

test('normalizeError: details is undefined when no extras were present', () => {
  const result = normalizeError({ code: IpcErrorCode.Aborted, message: 'cancelled' })
  assert.equal(result.details, undefined)
})

// ── encodeIpcError ────────────────────────────────────────────────────────────

const SENTINEL = '__ABYSS_IPC_ERROR__'

test('encodeIpcError: result is a string containing the sentinel prefix', () => {
  const encoded = encodeIpcError(new Error('boom'))
  assert.ok(typeof encoded === 'string')
  assert.ok(encoded.includes(SENTINEL), `Expected sentinel in "${encoded}"`)
})

test('encodeIpcError: the part after the sentinel is valid JSON', () => {
  const encoded = encodeIpcError({ code: IpcErrorCode.DiskFull, message: 'no space' })
  const jsonPart = encoded.slice(encoded.indexOf(SENTINEL) + SENTINEL.length)
  assert.doesNotThrow(() => JSON.parse(jsonPart))
})

test('encodeIpcError: the JSON contains code and message', () => {
  const err = { code: IpcErrorCode.PathScope, message: 'escaped' }
  const encoded = encodeIpcError(err)
  const parsed = JSON.parse(
    encoded.slice(encoded.indexOf(SENTINEL) + SENTINEL.length),
  ) as { code: string; message: string }
  assert.equal(parsed.code, IpcErrorCode.PathScope)
  assert.equal(parsed.message, 'escaped')
})

// ── decodeIpcError ────────────────────────────────────────────────────────────

test('decodeIpcError: round-trips code, message, and filePath', () => {
  const original = {
    code: IpcErrorCode.ReadPermission,
    message: 'EACCES reading config',
    filePath: '/root/secret',
  }
  const encoded = encodeIpcError(original)
  // Simulate what Electron does: the sentinel string becomes the Error.message
  const wireError = new Error(encoded)
  const decoded = decodeIpcError(wireError)

  assert.ok(decoded instanceof IpcError)
  assert.equal(decoded.code, IpcErrorCode.ReadPermission)
  assert.equal(decoded.message, 'EACCES reading config')
  assert.equal(decoded.filePath, '/root/secret')
})

test('decodeIpcError: round-trips with no filePath when none was set', () => {
  const original = { code: IpcErrorCode.Aborted, message: 'cancelled' }
  const decoded = decodeIpcError(new Error(encodeIpcError(original)))
  assert.equal(decoded.code, IpcErrorCode.Aborted)
  assert.equal(decoded.message, 'cancelled')
  assert.equal(decoded.filePath, undefined)
})

test('decodeIpcError: plain Error without sentinel returns IpcErrorCode.Unknown with original message', () => {
  const plainErr = new Error('totally ordinary error')
  const decoded = decodeIpcError(plainErr)
  assert.ok(decoded instanceof IpcError)
  assert.equal(decoded.code, IpcErrorCode.Unknown)
  assert.equal(decoded.message, 'totally ordinary error')
})

test('decodeIpcError: plain string without sentinel returns IpcErrorCode.Unknown', () => {
  const decoded = decodeIpcError('raw string rejection')
  assert.ok(decoded instanceof IpcError)
  assert.equal(decoded.code, IpcErrorCode.Unknown)
  assert.equal(decoded.message, 'raw string rejection')
})

test('decodeIpcError: returns the same IpcError instance when already decoded', () => {
  const ipcErr = new IpcError({
    code: IpcErrorCode.NotFound,
    message: 'gone',
  })
  const decoded = decodeIpcError(ipcErr)
  assert.equal(decoded, ipcErr)
})

// ── IpcError.filePath ─────────────────────────────────────────────────────────

test('IpcError.filePath: returns the string detail when present', () => {
  const err = new IpcError({
    code: IpcErrorCode.ConfigParse,
    message: 'parse failed',
    details: { filePath: '/home/user/.claude.json' },
  })
  assert.equal(err.filePath, '/home/user/.claude.json')
})

test('IpcError.filePath: returns undefined when details has no filePath', () => {
  const err = new IpcError({
    code: IpcErrorCode.DiskFull,
    message: 'disk full',
    details: { otherKey: 42 },
  })
  assert.equal(err.filePath, undefined)
})

test('IpcError.filePath: returns undefined when details is absent', () => {
  const err = new IpcError({ code: IpcErrorCode.Unknown, message: 'unknown' })
  assert.equal(err.filePath, undefined)
})

test('IpcError.filePath: returns undefined when filePath detail is not a string', () => {
  const err = new IpcError({
    code: IpcErrorCode.ConfigParse,
    message: 'parse',
    details: { filePath: 123 },
  })
  assert.equal(err.filePath, undefined)
})
