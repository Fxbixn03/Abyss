/**
 * Tests for `core/os-errors.ts` predicates and `core/raw-settings.ts` allowlist
 * guard + JSON-validity check.
 *
 * All tests are deterministic: `isPermissionError` / `isDiskError` are pure
 * functions; the `raw-settings` tests write to OS temp dirs that are created
 * and cleaned up per-test.
 */

import { test } from 'node:test'
import assert from 'node:assert/strict'
import os from 'node:os'
import path from 'node:path'
import { promises as fs } from 'node:fs'

import { isPermissionError, isDiskError } from '@core/os-errors'
import { readRawSettings, writeRawSettings } from '@core/raw-settings'
import { ConfigValidationError } from '@core/config-error'

// ── helpers ───────────────────────────────────────────────────────────────────

async function tmp(prefix: string): Promise<string> {
  return fs.mkdtemp(path.join(os.tmpdir(), prefix))
}

// ── isPermissionError ─────────────────────────────────────────────────────────

test('isPermissionError: returns true for { code: "EACCES" }', () => {
  assert.equal(isPermissionError({ code: 'EACCES' }), true)
})

test('isPermissionError: returns true for { code: "EPERM" }', () => {
  assert.equal(isPermissionError({ code: 'EPERM' }), true)
})

test('isPermissionError: returns false for { code: "ENOENT" }', () => {
  assert.equal(isPermissionError({ code: 'ENOENT' }), false)
})

test('isPermissionError: returns false for null', () => {
  assert.equal(isPermissionError(null), false)
})

test('isPermissionError: returns false for a plain string', () => {
  assert.equal(isPermissionError('EACCES'), false)
})

test('isPermissionError: returns false for undefined', () => {
  assert.equal(isPermissionError(undefined), false)
})

// ── isDiskError ───────────────────────────────────────────────────────────────

test('isDiskError: returns true for { code: "ENOSPC" }', () => {
  assert.equal(isDiskError({ code: 'ENOSPC' }), true)
})

test('isDiskError: returns true for { code: "EXDEV" }', () => {
  assert.equal(isDiskError({ code: 'EXDEV' }), true)
})

test('isDiskError: returns false for { code: "EACCES" }', () => {
  assert.equal(isDiskError({ code: 'EACCES' }), false)
})

test('isDiskError: returns false for { code: "ENOENT" }', () => {
  assert.equal(isDiskError({ code: 'ENOENT' }), false)
})

test('isDiskError: returns false for null', () => {
  assert.equal(isDiskError(null), false)
})

test('isDiskError: returns false for undefined', () => {
  assert.equal(isDiskError(undefined), false)
})

// ── raw-settings: allowlist guard ─────────────────────────────────────────────

test('writeRawSettings: throws for a non-allowed filename', async () => {
  const dir = await tmp('abyss-raw-settings-test-')
  try {
    await assert.rejects(
      () =>
        writeRawSettings(
          dir,
          '../../evil.json' as Parameters<typeof writeRawSettings>[1],
          '{}',
        ),
      (err: unknown) => {
        assert.ok(err instanceof Error)
        assert.match(err.message, /Not an allowed settings file/)
        return true
      },
    )
  } finally {
    await fs.rm(dir, { recursive: true, force: true })
  }
})

// ── raw-settings: JSON-validity guard ─────────────────────────────────────────

test('writeRawSettings: throws ConfigValidationError for invalid JSON content', async () => {
  const dir = await tmp('abyss-raw-settings-test-')
  try {
    await assert.rejects(
      () => writeRawSettings(dir, 'settings.json', 'not valid json {{{'),
      (err: unknown) => {
        assert.ok(err instanceof ConfigValidationError)
        assert.equal(err.name, 'ConfigValidationError')
        return true
      },
    )
  } finally {
    await fs.rm(dir, { recursive: true, force: true })
  }
})

// ── raw-settings: round-trip ──────────────────────────────────────────────────

test('writeRawSettings + readRawSettings: round-trips valid JSON from a real temp dir', async () => {
  const dir = await tmp('abyss-raw-settings-test-')
  try {
    const content = JSON.stringify({ key: 'value', num: 42 })
    const writeResult = await writeRawSettings(dir, 'settings.json', content)
    assert.equal(writeResult.success, true)
    assert.ok(writeResult.path.endsWith('settings.json'))

    const readResult = await readRawSettings(dir, 'settings.json')
    assert.equal(readResult.exists, true)
    assert.equal(readResult.content, content)
    assert.ok(readResult.path.endsWith('settings.json'))
  } finally {
    await fs.rm(dir, { recursive: true, force: true })
  }
})

test('readRawSettings: returns exists=false and empty content when file does not exist', async () => {
  const dir = await tmp('abyss-raw-settings-test-')
  try {
    const result = await readRawSettings(dir, 'settings.local.json')
    assert.equal(result.exists, false)
    assert.equal(result.content, '')
    assert.ok(result.path.endsWith('settings.local.json'))
  } finally {
    await fs.rm(dir, { recursive: true, force: true })
  }
})
