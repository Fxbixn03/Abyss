/**
 * Automatic config backups. Once per day (on the first launch of the day) the
 * whole agent config is exported as a bundle JSON into the backup directory, and
 * old backups are pruned to the configured retention count. Node-only.
 */

import path from 'node:path'
import { promises as fs } from 'node:fs'
import type { OsEnv } from '@/shared/types/agent'
import type { BackupInfo } from '@/shared/types/backup'
import { exportBundle } from './bundle'

const PREFIX = 'abyss-backup-'

export function defaultBackupDir(userData: string): string {
  return path.join(userData, 'backups')
}

function todayStamp(): string {
  return new Date().toISOString().slice(0, 10)
}

export async function listBackups(dir: string): Promise<BackupInfo[]> {
  const entries = await fs.readdir(dir).catch(() => [] as string[])
  const infos: BackupInfo[] = []
  for (const name of entries) {
    if (!name.startsWith(PREFIX) || !name.endsWith('.json')) continue
    const full = path.join(dir, name)
    const stat = await fs.stat(full).catch(() => null)
    if (!stat) continue
    infos.push({
      name,
      path: full,
      createdAt: stat.mtime.toISOString(),
      sizeBytes: stat.size,
    })
  }
  // Names embed an ISO timestamp, so lexical sort == chronological.
  return infos.sort((a, b) => b.name.localeCompare(a.name))
}

async function prune(dir: string, keep: number): Promise<void> {
  const backups = await listBackups(dir)
  for (const old of backups.slice(Math.max(1, keep))) {
    await fs.rm(old.path, { force: true })
  }
}

export async function createBackup(
  env: OsEnv,
  dir: string,
  keep: number,
): Promise<BackupInfo> {
  await fs.mkdir(dir, { recursive: true })
  const bundle = await exportBundle(env)
  const stamp = new Date().toISOString().replace(/[:.]/g, '-')
  const name = `${PREFIX}${stamp}.json`
  const full = path.join(dir, name)
  await fs.writeFile(full, `${JSON.stringify(bundle, null, 2)}\n`, 'utf8')
  await prune(dir, keep)
  const stat = await fs.stat(full)
  return {
    name,
    path: full,
    createdAt: stat.mtime.toISOString(),
    sizeBytes: stat.size,
  }
}

/** Create today's backup unless one already exists. Returns it, or null if skipped. */
export async function runDailyBackup(
  env: OsEnv,
  dir: string,
  keep: number,
): Promise<BackupInfo | null> {
  const existing = await listBackups(dir)
  const today = todayStamp()
  const madeToday = existing.some((b) => b.name.startsWith(`${PREFIX}${today}`))
  if (madeToday) return null
  return createBackup(env, dir, keep)
}
