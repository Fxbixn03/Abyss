/**
 * Unit tests for `core/profiles.ts` — saveProfile, listProfiles,
 * deleteProfile, and renameProfile.
 *
 * All tests use real temp directories (no mocks). `configureProfiles` is
 * called at the start of each test to point the module at an isolated dir.
 */

import { test } from 'node:test'
import assert from 'node:assert/strict'
import os from 'node:os'
import path from 'node:path'
import { promises as fs } from 'node:fs'
import { randomUUID } from 'node:crypto'

import {
  configureProfiles,
  saveProfile,
  listProfiles,
  deleteProfile,
  renameProfile,
} from '@core/profiles'
import { ConfigParseError, ConfigWriteError } from '@core/config-error'
import type { ExportBundle } from '@/shared/types/bundle'

// ── helpers ───────────────────────────────────────────────────────────────────

async function tmp(prefix: string): Promise<string> {
  return fs.mkdtemp(path.join(os.tmpdir(), prefix))
}

/** Minimal valid ExportBundle used across tests. */
function makeBundle(agentId = 'claude'): ExportBundle {
  return {
    $schema: 'abyss-bundle/v1',
    version: 1,
    exportedAt: new Date().toISOString(),
    agents: [
      {
        agentId,
        basePath: '/tmp/fake',
        files: { instructions: '# Hello\n' },
      },
    ],
  }
}

// ── saveProfile ───────────────────────────────────────────────────────────────

test('saveProfile: writes a file whose name matches the returned meta.id', async () => {
  const dir = await tmp('abyss-prof-save-')
  try {
    configureProfiles(dir)
    const bundle = makeBundle()
    const meta = await saveProfile('Work', bundle)

    // The meta.id must be a UUID (the file is named <uuid>.json).
    const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    assert.ok(uuidRe.test(meta.id), `Expected meta.id to be a UUID, got "${meta.id}"`)

    // The file must exist on disk at the expected path.
    const filePath = path.join(dir, `${meta.id}.json`)
    const exists = await fs.access(filePath).then(() => true).catch(() => false)
    assert.ok(exists, `Expected profile file to exist at ${filePath}`)
  } finally {
    await fs.rm(dir, { recursive: true, force: true })
  }
})

test('saveProfile: returned meta contains the trimmed name and correct agentIds', async () => {
  const dir = await tmp('abyss-prof-meta-')
  try {
    configureProfiles(dir)
    const bundle = makeBundle('gemini')
    const meta = await saveProfile('  My Profile  ', bundle)

    assert.equal(meta.name, 'My Profile', 'Expected name to be trimmed')
    assert.deepEqual(meta.agentIds, ['gemini'], 'Expected agentIds to match the bundle agents')
    assert.ok(meta.createdAt.length > 0, 'Expected createdAt to be a non-empty ISO string')
  } finally {
    await fs.rm(dir, { recursive: true, force: true })
  }
})

test('saveProfile: empty name falls back to "Untitled profile"', async () => {
  const dir = await tmp('abyss-prof-unnamed-')
  try {
    configureProfiles(dir)
    const meta = await saveProfile('   ', makeBundle())
    assert.equal(meta.name, 'Untitled profile')
  } finally {
    await fs.rm(dir, { recursive: true, force: true })
  }
})

// ── listProfiles ──────────────────────────────────────────────────────────────

test('listProfiles: returns all saved profiles', async () => {
  const dir = await tmp('abyss-prof-list-')
  try {
    configureProfiles(dir)
    await saveProfile('Alpha', makeBundle('claude'))
    await saveProfile('Beta', makeBundle('codex'))

    const metas = await listProfiles()
    assert.equal(metas.length, 2, 'Expected two profiles in the list')
    const names = metas.map((m) => m.name)
    assert.ok(names.includes('Alpha'), 'Expected Alpha in the list')
    assert.ok(names.includes('Beta'), 'Expected Beta in the list')
  } finally {
    await fs.rm(dir, { recursive: true, force: true })
  }
})

test('listProfiles: returns profiles sorted by createdAt descending', async () => {
  const dir = await tmp('abyss-prof-sort-')
  try {
    configureProfiles(dir)

    // Write three profile files with distinct, controlled timestamps.
    const ids = [randomUUID(), randomUUID(), randomUUID()]
    const timestamps = [
      '2024-01-01T10:00:00.000Z',
      '2024-03-01T10:00:00.000Z',
      '2024-02-01T10:00:00.000Z',
    ]
    for (let i = 0; i < 3; i++) {
      const meta = {
        id: ids[i],
        name: `Profile ${i}`,
        createdAt: timestamps[i],
        agentIds: ['claude'],
      }
      const profile = { meta, bundle: makeBundle() }
      await fs.writeFile(
        path.join(dir, `${ids[i]}.json`),
        `${JSON.stringify(profile, null, 2)}\n`,
        'utf8',
      )
    }

    const metas = await listProfiles()
    assert.equal(metas.length, 3, 'Expected three profiles')
    // Sorted descending: March > February > January
    assert.equal(metas[0].createdAt, '2024-03-01T10:00:00.000Z', 'Expected March to be first')
    assert.equal(metas[1].createdAt, '2024-02-01T10:00:00.000Z', 'Expected February to be second')
    assert.equal(metas[2].createdAt, '2024-01-01T10:00:00.000Z', 'Expected January to be last')
  } finally {
    await fs.rm(dir, { recursive: true, force: true })
  }
})

test('listProfiles: propagates ConfigParseError when a JSON file is corrupt', async () => {
  const dir = await tmp('abyss-prof-corrupt-')
  try {
    configureProfiles(dir)

    // Place a corrupt JSON file inside the profiles directory.
    const corruptId = randomUUID()
    await fs.writeFile(
      path.join(dir, `${corruptId}.json`),
      '{ this is not valid json!!!',
      'utf8',
    )

    // listProfiles must propagate the ConfigParseError rather than swallowing it.
    await assert.rejects(
      listProfiles(),
      (err: unknown) => {
        assert.ok(
          err instanceof ConfigParseError,
          `Expected ConfigParseError, got ${String(err)}`,
        )
        return true
      },
    )
  } finally {
    await fs.rm(dir, { recursive: true, force: true })
  }
})

test('listProfiles: returns empty array when the directory is empty', async () => {
  const dir = await tmp('abyss-prof-empty-')
  try {
    configureProfiles(dir)
    const metas = await listProfiles()
    assert.deepEqual(metas, [])
  } finally {
    await fs.rm(dir, { recursive: true, force: true })
  }
})

test('listProfiles: ignores non-JSON files in the profiles directory', async () => {
  const dir = await tmp('abyss-prof-nonjson-')
  try {
    configureProfiles(dir)
    // Write a non-JSON file that should be silently skipped.
    await fs.writeFile(path.join(dir, 'README.txt'), 'not a profile', 'utf8')

    const meta = await saveProfile('Real', makeBundle())
    const metas = await listProfiles()

    assert.equal(metas.length, 1, 'Expected only the real profile in the list')
    assert.equal(metas[0].id, meta.id)
  } finally {
    await fs.rm(dir, { recursive: true, force: true })
  }
})

// ── deleteProfile ─────────────────────────────────────────────────────────────

test('deleteProfile: removes the file and returns true', async () => {
  const dir = await tmp('abyss-prof-del-')
  try {
    configureProfiles(dir)
    const meta = await saveProfile('ToDelete', makeBundle())
    const filePath = path.join(dir, `${meta.id}.json`)

    const result = await deleteProfile(meta.id)
    assert.equal(result, true, 'Expected deleteProfile to return true')

    const exists = await fs.access(filePath).then(() => true).catch(() => false)
    assert.equal(exists, false, 'Expected the profile file to be removed')
  } finally {
    await fs.rm(dir, { recursive: true, force: true })
  }
})

test('deleteProfile: returns false for a non-UUID id (unknown profile)', async () => {
  const dir = await tmp('abyss-prof-del-unknown-')
  try {
    configureProfiles(dir)
    // A non-UUID id is rejected by the fileFor() guard before any disk access.
    const result = await deleteProfile('not-a-valid-uuid')
    assert.equal(result, false, 'Expected deleteProfile to return false for an invalid id')
  } finally {
    await fs.rm(dir, { recursive: true, force: true })
  }
})

test('deleteProfile: returns true even for a UUID that points to no file (fs.rm force)', async () => {
  const dir = await tmp('abyss-prof-del-missing-')
  try {
    configureProfiles(dir)
    // A valid UUID that has no corresponding file — fs.rm with {force:true} does not throw.
    const result = await deleteProfile(randomUUID())
    assert.equal(result, true, 'Expected deleteProfile to return true (fs.rm force flag)')
  } finally {
    await fs.rm(dir, { recursive: true, force: true })
  }
})

// ── renameProfile ─────────────────────────────────────────────────────────────

test('renameProfile: updates the name and returns the updated meta', async () => {
  const dir = await tmp('abyss-prof-rename-')
  try {
    configureProfiles(dir)
    const meta = await saveProfile('OldName', makeBundle())

    const updated = await renameProfile(meta.id, 'NewName')
    assert.notEqual(updated, null, 'Expected renameProfile to return the updated meta')
    assert.equal(updated?.name, 'NewName', 'Expected the name to be updated')
    assert.equal(updated?.id, meta.id, 'Expected the id to remain unchanged')
  } finally {
    await fs.rm(dir, { recursive: true, force: true })
  }
})

test('renameProfile: round-trips the bundle unchanged after rename', async () => {
  const dir = await tmp('abyss-prof-roundtrip-')
  try {
    configureProfiles(dir)
    const bundle = makeBundle('codex')
    const meta = await saveProfile('OriginalName', bundle)

    await renameProfile(meta.id, 'RenamedProfile')

    // Re-read the file from disk and verify the bundle is intact.
    const raw = await fs.readFile(path.join(dir, `${meta.id}.json`), 'utf8')
    const stored = JSON.parse(raw) as { meta: { name: string }; bundle: ExportBundle }
    assert.equal(stored.meta.name, 'RenamedProfile', 'Expected name in file to be updated')
    assert.deepEqual(
      stored.bundle,
      bundle,
      'Expected the bundle to be unchanged after rename',
    )
  } finally {
    await fs.rm(dir, { recursive: true, force: true })
  }
})

test('renameProfile: returns null for a non-UUID id', async () => {
  const dir = await tmp('abyss-prof-rename-null-')
  try {
    configureProfiles(dir)
    const result = await renameProfile('not-a-valid-uuid', 'NewName')
    assert.equal(result, null, 'Expected renameProfile to return null for an invalid id')
  } finally {
    await fs.rm(dir, { recursive: true, force: true })
  }
})

test('renameProfile: returns null for a valid UUID that has no profile file', async () => {
  const dir = await tmp('abyss-prof-rename-missing-')
  try {
    configureProfiles(dir)
    const result = await renameProfile(randomUUID(), 'NewName')
    assert.equal(result, null, 'Expected renameProfile to return null when the profile does not exist')
  } finally {
    await fs.rm(dir, { recursive: true, force: true })
  }
})

test('renameProfile: trims the new name before writing', async () => {
  const dir = await tmp('abyss-prof-rename-trim-')
  try {
    configureProfiles(dir)
    const meta = await saveProfile('OrigName', makeBundle())
    const updated = await renameProfile(meta.id, '  Trimmed  ')
    assert.equal(updated?.name, 'Trimmed', 'Expected the name to be trimmed')
  } finally {
    await fs.rm(dir, { recursive: true, force: true })
  }
})

test('renameProfile: surfaces ConfigWriteError on permission-denied write', async () => {
  // Skip this test when running as root, because root bypasses file-mode checks.
  if (process.getuid?.() === 0) return

  const dir = await tmp('abyss-prof-rename-perm-')
  try {
    configureProfiles(dir)
    const meta = await saveProfile('OrigName', makeBundle())

    // Make the directory read-only so writeTextFileAtomic cannot create a temp file.
    await fs.chmod(dir, 0o555)

    await assert.rejects(
      renameProfile(meta.id, 'NewName'),
      (err: unknown) => {
        assert.ok(
          err instanceof ConfigWriteError,
          `Expected ConfigWriteError, got ${String(err)}`,
        )
        return true
      },
    )
  } finally {
    // Restore write permission before cleanup so fs.rm can remove the directory.
    await fs.chmod(dir, 0o755).catch(() => undefined)
    await fs.rm(dir, { recursive: true, force: true })
  }
})
