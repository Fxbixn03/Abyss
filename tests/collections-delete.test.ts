/**
 * Unit tests for `deleteCollectionItem` in `core/collections.ts`.
 *
 * Uses node:test + assert/strict with real temp directories (no mocks).
 * Covers the two internal branches (non-skill markdown file and skill folder),
 * the force-flag no-op for non-existent items, permission-error surfacing, and
 * path-traversal rejection.
 */

import { test } from 'node:test'
import assert from 'node:assert/strict'
import os from 'node:os'
import path from 'node:path'
import { promises as fs } from 'node:fs'

import { deleteCollectionItem } from '@core/collections'
import { ConfigWriteError } from '@core/config-error'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Create a unique temp dir and return its path. */
async function tmp(prefix: string): Promise<string> {
  return fs.mkdtemp(path.join(os.tmpdir(), prefix))
}

/**
 * Build a minimal collection directory structure under `basePath`.
 * Returns the collection dir so callers can verify it afterwards.
 *
 * For a non-skill item (e.g. kind = 'commands') the layout is:
 *   <basePath>/commands/<id>.md
 *
 * For a skill item the layout is:
 *   <basePath>/skills/<id>/SKILL.md
 */
async function makeItem(
  basePath: string,
  kind: 'commands' | 'skills',
  id: string,
  content = '# Test\n',
): Promise<string> {
  if (kind === 'skills') {
    const dir = path.join(basePath, 'skills', id)
    await fs.mkdir(dir, { recursive: true })
    await fs.writeFile(path.join(dir, 'SKILL.md'), content, 'utf8')
    return dir
  }
  const collDir = path.join(basePath, 'commands')
  await fs.mkdir(collDir, { recursive: true })
  const file = path.join(collDir, `${id}.md`)
  await fs.writeFile(file, content, 'utf8')
  return file
}

// ---------------------------------------------------------------------------
// Case 1 — non-skill command item that exists is removed
// ---------------------------------------------------------------------------

test('deleteCollectionItem: removing an existing non-skill item returns { success: true } and deletes the file', async () => {
  const basePath = await tmp('abyss-coll-del-1-')
  try {
    const filePath = await makeItem(basePath, 'commands', 'my-cmd')
    assert.ok(
      await fs
        .access(filePath)
        .then(() => true)
        .catch(() => false),
      'file should exist before deletion',
    )

    const result = await deleteCollectionItem('claude', basePath, 'commands', 'my-cmd')

    assert.deepEqual(result, { success: true })
    assert.equal(
      await fs
        .access(filePath)
        .then(() => true)
        .catch(() => false),
      false,
      'file should be gone after deletion',
    )
  } finally {
    await fs.rm(basePath, { recursive: true, force: true })
  }
})

// ---------------------------------------------------------------------------
// Case 2 — non-existent non-skill item does NOT throw (force flag)
// ---------------------------------------------------------------------------

test('deleteCollectionItem: deleting a non-existent non-skill item returns { success: true } without throwing', async () => {
  const basePath = await tmp('abyss-coll-del-2-')
  try {
    // Create the parent directory but NOT the file itself
    await fs.mkdir(path.join(basePath, 'commands'), { recursive: true })

    const result = await deleteCollectionItem(
      'claude',
      basePath,
      'commands',
      'ghost-cmd',
    )

    assert.deepEqual(result, { success: true })
  } finally {
    await fs.rm(basePath, { recursive: true, force: true })
  }
})

// ---------------------------------------------------------------------------
// Case 3 — skill item (folder) that exists is removed entirely
// ---------------------------------------------------------------------------

test('deleteCollectionItem: removing an existing skill folder returns { success: true } and deletes the folder', async () => {
  const basePath = await tmp('abyss-coll-del-3-')
  try {
    const skillDir = await makeItem(basePath, 'skills', 'my-skill')
    assert.ok(
      await fs
        .access(skillDir)
        .then(() => true)
        .catch(() => false),
      'skill folder should exist before deletion',
    )

    const result = await deleteCollectionItem('claude', basePath, 'skills', 'my-skill')

    assert.deepEqual(result, { success: true })
    assert.equal(
      await fs
        .access(skillDir)
        .then(() => true)
        .catch(() => false),
      false,
      'skill folder should be gone after deletion',
    )
  } finally {
    await fs.rm(basePath, { recursive: true, force: true })
  }
})

// ---------------------------------------------------------------------------
// Case 4 — permission-denied fs.rm on a non-skill file → ConfigWriteError
// ---------------------------------------------------------------------------

test('deleteCollectionItem: permission-denied rm on non-skill file throws ConfigWriteError', {
  skip: process.getuid?.() === 0 ? 'skipped when running as root' : false,
}, async () => {
  const basePath = await tmp('abyss-coll-del-4-')
  try {
    await makeItem(basePath, 'commands', 'locked-cmd')
    const collDir = path.join(basePath, 'commands')

    // Make the parent directory read-only so fs.rm on the file fails
    await fs.chmod(collDir, 0o555)

    await assert.rejects(
      () => deleteCollectionItem('claude', basePath, 'commands', 'locked-cmd'),
      (err: unknown) => {
        assert.ok(
          err instanceof ConfigWriteError,
          `expected ConfigWriteError, got ${String(err)}`,
        )
        assert.equal(err.name, 'ConfigWriteError')
        return true
      },
    )
  } finally {
    // Restore permissions before cleanup so fs.rm can remove the directory
    const collDir = path.join(basePath, 'commands')
    await fs.chmod(collDir, 0o755).catch(() => undefined)
    await fs.rm(basePath, { recursive: true, force: true })
  }
})

// ---------------------------------------------------------------------------
// Case 5 — permission-denied fs.rm on a skill folder → ConfigWriteError
// ---------------------------------------------------------------------------

test('deleteCollectionItem: permission-denied rm on skill folder throws ConfigWriteError', {
  skip: process.getuid?.() === 0 ? 'skipped when running as root' : false,
}, async () => {
  const basePath = await tmp('abyss-coll-del-5-')
  try {
    await makeItem(basePath, 'skills', 'locked-skill')
    const skillsDir = path.join(basePath, 'skills')

    // Make the skills parent directory read-only so fs.rm on the skill folder fails
    await fs.chmod(skillsDir, 0o555)

    await assert.rejects(
      () => deleteCollectionItem('claude', basePath, 'skills', 'locked-skill'),
      (err: unknown) => {
        assert.ok(
          err instanceof ConfigWriteError,
          `expected ConfigWriteError, got ${String(err)}`,
        )
        assert.equal(err.name, 'ConfigWriteError')
        return true
      },
    )
  } finally {
    // Restore permissions so cleanup can proceed
    const skillsDir = path.join(basePath, 'skills')
    await fs.chmod(skillsDir, 0o755).catch(() => undefined)
    await fs.rm(basePath, { recursive: true, force: true })
  }
})

// ---------------------------------------------------------------------------
// Case 6 — skill id with path-traversal segments is rejected before disk access
// ---------------------------------------------------------------------------

test('deleteCollectionItem: skill id with path-traversal throws a sanitization error before any disk access', async () => {
  // Skills use per-segment validation; `..` is explicitly rejected.
  // This temp dir is never touched — the sanitizer must throw before any IO.
  const basePath = await tmp('abyss-coll-del-6-')
  try {
    await assert.rejects(
      () => deleteCollectionItem('claude', basePath, 'skills', '../../etc'),
      (err: unknown) => {
        assert.ok(err instanceof Error, 'should be an Error')
        // The message must mention the invalid id
        assert.ok(
          err.message.toLowerCase().includes('invalid'),
          `expected 'invalid' in error message, got: "${err.message}"`,
        )
        return true
      },
    )
  } finally {
    await fs.rm(basePath, { recursive: true, force: true })
  }
})
