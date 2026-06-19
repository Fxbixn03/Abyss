/**
 * Unit tests for the `ensureDir` error-wrapping added in F342.
 *
 * Verifies that EACCES/EPERM from `fs.mkdir` inside `ensureDir` are rethrown
 * as `ConfigWriteError` and ENOSPC/EXDEV as `ConfigDiskError`, both carrying
 * the directory path in `filePath`.
 *
 * Uses real temp directories — no mocks needed for the permission case (we just
 * chmod 000 the parent). ENOSPC/EXDEV are simulated by replacing `fs.mkdir`
 * with a stub that throws a synthetic OS error.
 */

import { test } from 'node:test'
import assert from 'node:assert/strict'
import os from 'node:os'
import path from 'node:path'
import { promises as fs } from 'node:fs'

import { ensureDir } from '@core/json-file'
import { ConfigWriteError, ConfigDiskError } from '@core/config-error'

async function tmp(prefix: string): Promise<string> {
  return fs.mkdtemp(path.join(os.tmpdir(), prefix))
}

// ── EACCES → ConfigWriteError ─────────────────────────────────────────────────

test('ensureDir: EACCES on read-only parent rethrows as ConfigWriteError', async () => {
  // Skip this test when running as root (chmod 000 has no effect on root).
  if (process.getuid?.() === 0) return

  const base = await tmp('abyss-ensuredir-acces-')
  // Make the base directory read-only so mkdir inside it will get EACCES.
  await fs.chmod(base, 0o444)
  const target = path.join(base, 'sub', 'deep')

  try {
    await assert.rejects(
      () => ensureDir(target),
      (err: unknown) => {
        assert.ok(
          err instanceof ConfigWriteError,
          `Expected ConfigWriteError but got: ${String(err)}`,
        )
        assert.equal(err.name, 'ConfigWriteError')
        assert.equal(err.filePath, target)
        assert.ok(err.message.includes(target))
        return true
      },
    )
  } finally {
    // Restore write permission so cleanup can remove the temp dir.
    await fs.chmod(base, 0o755)
    await fs.rm(base, { recursive: true, force: true })
  }
})

// ── ENOSPC → ConfigDiskError (via synthetic error) ───────────────────────────

test('ensureDir: synthetic ENOSPC rethrows as ConfigDiskError carrying the dir path', async () => {
  const base = await tmp('abyss-ensuredir-enospc-')
  // We cannot reliably fill a real disk in a test, so we inject a synthetic
  // ENOSPC errno by intercepting the mkdir call via monkey-patching.  The
  // monkey-patch is scoped to this test and restored in the finally block.
  const original = fs.mkdir.bind(fs)

  let called = false
  ;(fs as { mkdir: unknown }).mkdir = async (..._args: unknown[]) => {
    if (!called) {
      called = true
      const err = Object.assign(new Error('ENOSPC: no space left on device, mkdir'), {
        code: 'ENOSPC',
        syscall: 'mkdir',
      })
      throw err
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return original(...(_args as Parameters<typeof original>)) as any
  }

  const target = path.join(base, 'nospc-sub')
  try {
    await assert.rejects(
      () => ensureDir(target),
      (err: unknown) => {
        assert.ok(
          err instanceof ConfigDiskError,
          `Expected ConfigDiskError but got: ${String(err)}`,
        )
        assert.equal(err.name, 'ConfigDiskError')
        assert.equal(err.filePath, target)
        assert.ok(err.message.includes(target))
        return true
      },
    )
  } finally {
    ;(fs as { mkdir: unknown }).mkdir = original
    await fs.rm(base, { recursive: true, force: true })
  }
})

// ── EXDEV → ConfigDiskError (via synthetic error) ────────────────────────────

test('ensureDir: synthetic EXDEV rethrows as ConfigDiskError carrying the dir path', async () => {
  const base = await tmp('abyss-ensuredir-exdev-')
  const original = fs.mkdir.bind(fs)

  let called = false
  ;(fs as { mkdir: unknown }).mkdir = async (..._args: unknown[]) => {
    if (!called) {
      called = true
      const err = Object.assign(
        new Error('EXDEV: cross-device link not permitted, mkdir'),
        { code: 'EXDEV', syscall: 'mkdir' },
      )
      throw err
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return original(...(_args as Parameters<typeof original>)) as any
  }

  const target = path.join(base, 'exdev-sub')
  try {
    await assert.rejects(
      () => ensureDir(target),
      (err: unknown) => {
        assert.ok(
          err instanceof ConfigDiskError,
          `Expected ConfigDiskError but got: ${String(err)}`,
        )
        assert.equal(err.filePath, target)
        return true
      },
    )
  } finally {
    ;(fs as { mkdir: unknown }).mkdir = original
    await fs.rm(base, { recursive: true, force: true })
  }
})

// ── happy path: ensureDir still works for a normal directory ─────────────────

test('ensureDir: creates nested directories when they do not exist', async () => {
  const base = await tmp('abyss-ensuredir-ok-')
  const target = path.join(base, 'a', 'b', 'c')
  try {
    await ensureDir(target)
    const stat = await fs.stat(target)
    assert.ok(stat.isDirectory())
  } finally {
    await fs.rm(base, { recursive: true, force: true })
  }
})

// ── idempotent: ensureDir on an existing directory succeeds ──────────────────

test('ensureDir: is idempotent when the directory already exists', async () => {
  const base = await tmp('abyss-ensuredir-idem-')
  try {
    await ensureDir(base)
    const stat = await fs.stat(base)
    assert.ok(stat.isDirectory())
  } finally {
    await fs.rm(base, { recursive: true, force: true })
  }
})
