/**
 * Unit tests for `core/backup.ts` — createBackup, listBackups,
 * runDailyBackup, and backupStatus.
 *
 * All tests use real temp directories (no mocks) and a minimal OsEnv that
 * points home/appData at empty temp dirs so exportBundle never touches the
 * real home directory.
 */

import { test } from 'node:test'
import assert from 'node:assert/strict'
import os from 'node:os'
import path from 'node:path'
import { promises as fs } from 'node:fs'

import {
  listBackups,
  createBackup,
  runDailyBackup,
  backupStatus,
} from '@core/backup'
import type { OsEnv } from '@/shared/types/agent'

// ── helpers ───────────────────────────────────────────────────────────────────

async function tmp(prefix: string): Promise<string> {
  return fs.mkdtemp(path.join(os.tmpdir(), prefix))
}

/**
 * Build a minimal OsEnv pointing at empty temp directories so that
 * exportBundle (called by createBackup) never reads from or writes to
 * the real home directory.
 */
function makeEnv(home: string, appData: string): OsEnv {
  return { home, appData, platform: process.platform as OsEnv['platform'] }
}

// ── listBackups on an empty directory returns [] ──────────────────────────────

test('listBackups: empty directory returns empty array', async () => {
  const dir = await tmp('abyss-bu-empty-')
  try {
    const result = await listBackups(dir)
    assert.deepEqual(result, [])
  } finally {
    await fs.rm(dir, { recursive: true, force: true })
  }
})

test('listBackups: non-existent directory returns empty array without throwing', async () => {
  const dir = path.join(os.tmpdir(), `abyss-bu-nonexistent-${Date.now()}`)
  const result = await listBackups(dir)
  assert.deepEqual(result, [])
})

test('listBackups: ignores files that do not match the abyss-backup- prefix', async () => {
  const dir = await tmp('abyss-bu-skip-')
  try {
    await fs.writeFile(path.join(dir, 'other-file.json'), '{}', 'utf8')
    await fs.writeFile(path.join(dir, 'abyss-backup-no-extension'), '{}', 'utf8')
    const result = await listBackups(dir)
    assert.deepEqual(result, [])
  } finally {
    await fs.rm(dir, { recursive: true, force: true })
  }
})

// ── createBackup writes a valid JSON file and returns correct BackupInfo ───────

test('createBackup: writes a file whose name starts with abyss-backup-', async () => {
  const dir = await tmp('abyss-bu-create-')
  const home = await tmp('abyss-bu-create-home-')
  const appData = await tmp('abyss-bu-create-app-')
  try {
    const env = makeEnv(home, appData)
    const info = await createBackup(env, dir, 3)

    assert.ok(
      info.name.startsWith('abyss-backup-'),
      `Expected name to start with "abyss-backup-", got "${info.name}"`,
    )
    assert.ok(
      info.name.endsWith('.json'),
      `Expected name to end with ".json", got "${info.name}"`,
    )
    assert.ok(info.path.startsWith(dir), 'Expected path to be inside the backup dir')
    assert.ok(info.sizeBytes > 0, 'Expected sizeBytes > 0')
    assert.ok(info.createdAt.length > 0, 'Expected createdAt to be a non-empty ISO string')
  } finally {
    for (const d of [dir, home, appData])
      await fs.rm(d, { recursive: true, force: true })
  }
})

test('createBackup: the written file is a valid Abyss bundle JSON', async () => {
  const dir = await tmp('abyss-bu-valid-')
  const home = await tmp('abyss-bu-valid-home-')
  const appData = await tmp('abyss-bu-valid-app-')
  try {
    const env = makeEnv(home, appData)
    const info = await createBackup(env, dir, 3)

    const raw = await fs.readFile(info.path, 'utf8')
    const parsed = JSON.parse(raw) as Record<string, unknown>
    assert.equal(parsed['$schema'], 'abyss-bundle/v1', 'Expected $schema to be "abyss-bundle/v1"')
    assert.equal(parsed['version'], 1, 'Expected version to be 1')
    assert.ok(Array.isArray(parsed['agents']), 'Expected agents to be an array')
    assert.ok(typeof parsed['exportedAt'] === 'string', 'Expected exportedAt to be a string')
  } finally {
    for (const d of [dir, home, appData])
      await fs.rm(d, { recursive: true, force: true })
  }
})

test('createBackup: the returned BackupInfo file is present on disk', async () => {
  const dir = await tmp('abyss-bu-exists-')
  const home = await tmp('abyss-bu-exists-home-')
  const appData = await tmp('abyss-bu-exists-app-')
  try {
    const env = makeEnv(home, appData)
    const info = await createBackup(env, dir, 3)

    const stat = await fs.stat(info.path)
    assert.ok(stat.isFile(), 'Expected backup path to be a regular file')
    assert.equal(stat.size, info.sizeBytes, 'sizeBytes must match the actual file size')
  } finally {
    for (const d of [dir, home, appData])
      await fs.rm(d, { recursive: true, force: true })
  }
})

test('createBackup: listBackups returns the created backup', async () => {
  const dir = await tmp('abyss-bu-list-after-')
  const home = await tmp('abyss-bu-list-after-home-')
  const appData = await tmp('abyss-bu-list-after-app-')
  try {
    const env = makeEnv(home, appData)
    await createBackup(env, dir, 3)
    const list = await listBackups(dir)
    assert.equal(list.length, 1, 'Expected exactly one backup after createBackup')
    assert.ok(list[0].name.startsWith('abyss-backup-'))
  } finally {
    for (const d of [dir, home, appData])
      await fs.rm(d, { recursive: true, force: true })
  }
})

// ── pruning: calling createBackup twice with keep=1 removes the older one ─────

test('createBackup: prunes older backups down to keep=1 after second call', async () => {
  const dir = await tmp('abyss-bu-prune-')
  const home = await tmp('abyss-bu-prune-home-')
  const appData = await tmp('abyss-bu-prune-app-')
  try {
    const env = makeEnv(home, appData)

    const first = await createBackup(env, dir, 1)
    // Small delay to ensure the two filenames (which embed a timestamp) differ.
    await new Promise<void>((resolve) => setTimeout(resolve, 10))
    const second = await createBackup(env, dir, 1)

    const list = await listBackups(dir)
    assert.equal(list.length, 1, 'Expected exactly one backup after pruning to keep=1')
    // The newer (second) backup should be the surviving one.
    assert.equal(list[0].name, second.name, 'Expected the most recent backup to survive pruning')

    // The first backup file must no longer exist.
    await assert.rejects(
      fs.access(first.path),
      'Expected the first (older) backup to be deleted after pruning',
    )
  } finally {
    for (const d of [dir, home, appData])
      await fs.rm(d, { recursive: true, force: true })
  }
})

test('createBackup: with keep=2, two backups are retained and the third removes the oldest', async () => {
  const dir = await tmp('abyss-bu-prune2-')
  const home = await tmp('abyss-bu-prune2-home-')
  const appData = await tmp('abyss-bu-prune2-app-')
  try {
    const env = makeEnv(home, appData)

    const first = await createBackup(env, dir, 2)
    await new Promise<void>((resolve) => setTimeout(resolve, 10))
    const second = await createBackup(env, dir, 2)
    await new Promise<void>((resolve) => setTimeout(resolve, 10))
    await createBackup(env, dir, 2)

    const list = await listBackups(dir)
    assert.equal(list.length, 2, 'Expected exactly two backups after pruning to keep=2')

    // The oldest (first) should no longer exist.
    await assert.rejects(
      fs.access(first.path),
      'Expected the oldest backup to be pruned after third createBackup with keep=2',
    )
    // The second should still exist.
    await assert.doesNotReject(
      fs.access(second.path),
      'Expected the second backup to still exist after pruning to keep=2',
    )
  } finally {
    for (const d of [dir, home, appData])
      await fs.rm(d, { recursive: true, force: true })
  }
})

// ── runDailyBackup: skips if today's backup already exists ────────────────────

test('runDailyBackup: returns a BackupInfo on the first call of the day', async () => {
  const dir = await tmp('abyss-bu-daily-')
  const home = await tmp('abyss-bu-daily-home-')
  const appData = await tmp('abyss-bu-daily-app-')
  try {
    const env = makeEnv(home, appData)
    const result = await runDailyBackup(env, dir, 3)
    assert.notEqual(result, null, 'Expected runDailyBackup to return a BackupInfo on first call')
    assert.ok(result?.name.startsWith('abyss-backup-'))
  } finally {
    for (const d of [dir, home, appData])
      await fs.rm(d, { recursive: true, force: true })
  }
})

test('runDailyBackup: returns null on the second call on the same day', async () => {
  const dir = await tmp('abyss-bu-daily-skip-')
  const home = await tmp('abyss-bu-daily-skip-home-')
  const appData = await tmp('abyss-bu-daily-skip-app-')
  try {
    const env = makeEnv(home, appData)
    const first = await runDailyBackup(env, dir, 3)
    assert.notEqual(first, null, 'First call should succeed')

    const second = await runDailyBackup(env, dir, 3)
    assert.equal(second, null, 'Second call on same day should return null (skip)')
  } finally {
    for (const d of [dir, home, appData])
      await fs.rm(d, { recursive: true, force: true })
  }
})

test('runDailyBackup: only one backup file exists after two calls on the same day', async () => {
  const dir = await tmp('abyss-bu-daily-count-')
  const home = await tmp('abyss-bu-daily-count-home-')
  const appData = await tmp('abyss-bu-daily-count-app-')
  try {
    const env = makeEnv(home, appData)
    await runDailyBackup(env, dir, 3)
    await runDailyBackup(env, dir, 3)

    const list = await listBackups(dir)
    assert.equal(list.length, 1, 'Expected exactly one backup after two runDailyBackup calls on same day')
  } finally {
    for (const d of [dir, home, appData])
      await fs.rm(d, { recursive: true, force: true })
  }
})

// ── backupStatus: correct count and changedSinceLast immediately after backup ─

test('backupStatus: returns count=0 and changedSinceLast=false when no backups exist', async () => {
  const dir = await tmp('abyss-bu-status-empty-')
  const home = await tmp('abyss-bu-status-empty-home-')
  const appData = await tmp('abyss-bu-status-empty-app-')
  try {
    const env = makeEnv(home, appData)
    const status = await backupStatus(env, dir)
    assert.equal(status.count, 0)
    assert.equal(status.changedSinceLast, false)
    assert.equal(status.last, undefined)
  } finally {
    for (const d of [dir, home, appData])
      await fs.rm(d, { recursive: true, force: true })
  }
})

test('backupStatus: returns count=1 and changedSinceLast=false immediately after a backup', async () => {
  const dir = await tmp('abyss-bu-status-fresh-')
  const home = await tmp('abyss-bu-status-fresh-home-')
  const appData = await tmp('abyss-bu-status-fresh-app-')
  try {
    const env = makeEnv(home, appData)
    await createBackup(env, dir, 3)

    const status = await backupStatus(env, dir)
    assert.equal(status.count, 1, 'Expected count=1 after one backup')
    assert.equal(
      status.changedSinceLast,
      false,
      'Expected changedSinceLast=false immediately after backup (config unchanged)',
    )
    assert.ok(status.last !== undefined, 'Expected last to be set')
    assert.ok(status.last?.name.startsWith('abyss-backup-'))
  } finally {
    for (const d of [dir, home, appData])
      await fs.rm(d, { recursive: true, force: true })
  }
})

test('backupStatus: count reflects the actual number of backups', async () => {
  const dir = await tmp('abyss-bu-status-count-')
  const home = await tmp('abyss-bu-status-count-home-')
  const appData = await tmp('abyss-bu-status-count-app-')
  try {
    const env = makeEnv(home, appData)
    await createBackup(env, dir, 5)
    await new Promise<void>((resolve) => setTimeout(resolve, 10))
    await createBackup(env, dir, 5)
    await new Promise<void>((resolve) => setTimeout(resolve, 10))
    await createBackup(env, dir, 5)

    const status = await backupStatus(env, dir)
    assert.equal(status.count, 3, 'Expected count=3 after three backups with keep=5')
    assert.ok(status.last !== undefined)
  } finally {
    for (const d of [dir, home, appData])
      await fs.rm(d, { recursive: true, force: true })
  }
})

test('backupStatus: last points to the most recent backup', async () => {
  const dir = await tmp('abyss-bu-status-last-')
  const home = await tmp('abyss-bu-status-last-home-')
  const appData = await tmp('abyss-bu-status-last-app-')
  try {
    const env = makeEnv(home, appData)
    await createBackup(env, dir, 5)
    await new Promise<void>((resolve) => setTimeout(resolve, 10))
    const newest = await createBackup(env, dir, 5)

    const status = await backupStatus(env, dir)
    assert.equal(
      status.last?.name,
      newest.name,
      'Expected last to point at the most recent backup',
    )
  } finally {
    for (const d of [dir, home, appData])
      await fs.rm(d, { recursive: true, force: true })
  }
})
