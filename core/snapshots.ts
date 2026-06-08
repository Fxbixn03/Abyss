/**
 * File snapshots — a universal safety net. Hooked into {@link writeTextFileAtomic}
 * (the single chokepoint every config write goes through), so the previous
 * content of any file Abyss overwrites is preserved and can be restored.
 *
 * Layout: `<root>/<sha1(path)>/<timestamp>.snap` raw old content, plus a
 * `meta.json` in each dir recording the original absolute path. Node-only.
 */

import path from 'node:path'
import { promises as fs } from 'node:fs'
import { createHash } from 'node:crypto'
import { uniqueTempPath } from './tmp-path'
import type { SnapshotContent, SnapshotMeta } from '@/shared/types/snapshots'

interface SnapshotConfig {
  root: string
  /** Directories whose files are never snapshotted (e.g. Abyss's own data). */
  exclude: string[]
}

/** Keep at most this many snapshots per file; older ones are pruned. */
const MAX_PER_FILE = 30

let config: SnapshotConfig | null = null

export function configureSnapshots(cfg: SnapshotConfig): void {
  config = cfg
}

function hashPath(p: string): string {
  return createHash('sha1').update(path.resolve(p)).digest('hex')
}

function isExcluded(filePath: string): boolean {
  if (!config) return true
  const resolved = path.resolve(filePath)
  return config.exclude.some((dir) => {
    const base = path.resolve(dir)
    return resolved === base || resolved.startsWith(base + path.sep)
  })
}

async function pathExists(p: string): Promise<boolean> {
  try {
    await fs.access(p)
    return true
  } catch {
    return false
  }
}

/** Record `previousContent` as a snapshot of `filePath`. Best-effort, never throws. */
export async function recordSnapshot(
  filePath: string,
  previousContent: string,
): Promise<void> {
  if (!config || isExcluded(filePath)) return
  try {
    const dir = path.join(config.root, hashPath(filePath))
    await fs.mkdir(dir, { recursive: true })
    await fs.writeFile(
      path.join(dir, 'meta.json'),
      JSON.stringify({ originalPath: path.resolve(filePath) }),
      'utf8',
    )

    let stamp = Date.now()
    let snapPath = path.join(dir, `${stamp}.snap`)
    while (await pathExists(snapPath)) {
      stamp += 1
      snapPath = path.join(dir, `${stamp}.snap`)
    }
    await fs.writeFile(snapPath, previousContent, 'utf8')
    await prune(dir)
  } catch {
    // snapshots are best-effort; never block a real save
  }
}

async function prune(dir: string): Promise<void> {
  const stamps = await readStamps(dir)
  if (stamps.length <= MAX_PER_FILE) return
  const toRemove = stamps
    .sort((a, b) => a - b)
    .slice(0, stamps.length - MAX_PER_FILE)
  await Promise.all(
    toRemove.map((s) =>
      fs
        .rm(path.join(dir, `${s}.snap`), { force: true })
        .catch(() => undefined),
    ),
  )
}

async function readStamps(dir: string): Promise<number[]> {
  const entries = await fs.readdir(dir).catch(() => [] as string[])
  return entries
    .filter((e) => e.endsWith('.snap'))
    .map((e) => Number(e.replace(/\.snap$/, '')))
    .filter((n) => !Number.isNaN(n))
}

async function readOriginalPath(dir: string): Promise<string | null> {
  try {
    const raw = await fs.readFile(path.join(dir, 'meta.json'), 'utf8')
    const parsed = JSON.parse(raw) as { originalPath?: string }
    return parsed.originalPath ?? null
  } catch {
    return null
  }
}

async function metasForDir(
  hash: string,
  originalPath: string,
): Promise<SnapshotMeta[]> {
  if (!config) return []
  const dir = path.join(config.root, hash)
  const stamps = await readStamps(dir)
  const out: SnapshotMeta[] = []
  for (const stamp of stamps) {
    const stat = await fs
      .stat(path.join(dir, `${stamp}.snap`))
      .catch(() => null)
    if (!stat) continue
    out.push({
      id: `${hash}/${stamp}`,
      originalPath,
      fileName: path.basename(originalPath),
      timestamp: new Date(stamp).toISOString(),
      sizeBytes: stat.size,
    })
  }
  return out.sort((a, b) => b.timestamp.localeCompare(a.timestamp))
}

export async function listSnapshots(filePath: string): Promise<SnapshotMeta[]> {
  if (!config) return []
  return metasForDir(hashPath(filePath), path.resolve(filePath))
}

export async function listRecentSnapshots(
  limit = 100,
): Promise<SnapshotMeta[]> {
  if (!config) return []
  const dirs = await fs.readdir(config.root).catch(() => [] as string[])
  const all: SnapshotMeta[] = []
  for (const hash of dirs) {
    const originalPath = await readOriginalPath(path.join(config.root, hash))
    if (!originalPath) continue
    all.push(...(await metasForDir(hash, originalPath)))
  }
  return all
    .sort((a, b) => b.timestamp.localeCompare(a.timestamp))
    .slice(0, limit)
}

/** Decode + validate a snapshot id into its on-disk file path. */
function resolveSnapshot(id: string): { hash: string; file: string } | null {
  if (!config) return null
  const [hash, stamp] = id.split('/')
  if (!/^[a-f0-9]{40}$/.test(hash ?? '') || !/^\d+$/.test(stamp ?? '')) {
    return null
  }
  return { hash, file: path.join(config.root, hash, `${stamp}.snap`) }
}

export async function readSnapshot(
  id: string,
): Promise<SnapshotContent | null> {
  const resolved = resolveSnapshot(id)
  if (!resolved || !config) return null
  const content = await fs.readFile(resolved.file, 'utf8').catch(() => null)
  if (content === null) return null
  const originalPath =
    (await readOriginalPath(path.join(config.root, resolved.hash))) ?? ''
  const stat = await fs.stat(resolved.file).catch(() => null)
  const stamp = Number(id.split('/')[1])
  return {
    meta: {
      id,
      originalPath,
      fileName: path.basename(originalPath),
      timestamp: new Date(stamp).toISOString(),
      sizeBytes: stat?.size ?? content.length,
    },
    content,
  }
}

/**
 * Read the *current* on-disk content of a snapshot's original file, so the UI
 * can diff "what's live now" against the snapshot before restoring. Returns null
 * when the original path is unknown or the file no longer exists.
 */
export async function readSnapshotTarget(id: string): Promise<string | null> {
  const resolved = resolveSnapshot(id)
  if (!resolved || !config) return null
  const originalPath = await readOriginalPath(
    path.join(config.root, resolved.hash),
  )
  if (!originalPath) return null
  return fs.readFile(originalPath, 'utf8').catch(() => null)
}

/**
 * Restore a snapshot back onto its original file. The current content is itself
 * snapshotted first, so a restore can be undone. Returns the restored path.
 */
export async function restoreSnapshot(
  id: string,
): Promise<{ success: boolean; path: string } | null> {
  const snap = await readSnapshot(id)
  if (!snap || !snap.meta.originalPath) return null
  const target = snap.meta.originalPath

  // Snapshot the current content (if any) so the restore is reversible.
  const current = await fs.readFile(target, 'utf8').catch(() => null)
  if (current !== null && current !== snap.content) {
    await recordSnapshot(target, current)
  }

  await fs.mkdir(path.dirname(target), { recursive: true })
  const tmp = uniqueTempPath(target)
  await fs.writeFile(tmp, snap.content, 'utf8')
  await fs.rename(tmp, target)
  return { success: true, path: target }
}
