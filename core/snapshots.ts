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
import { isInsideRoot } from './path-scope'
import { ConfigDiskError, ConfigWriteError } from './config-error'
import { isDiskError, isPermissionError } from './os-errors'
import type { SnapshotContent, SnapshotMeta } from '@/shared/types/snapshots'

interface SnapshotConfig {
  root: string
  /** Directories whose files are never snapshotted (e.g. Abyss's own data). */
  exclude: string[]
  /**
   * Roots a restore is allowed to write back into. A snapshot's `originalPath`
   * comes from on-disk meta.json; re-checking it here keeps a tampered meta from
   * steering a restore write outside Abyss's allowed directories. Empty = allow.
   */
  allowedRoots?: string[]
  /**
   * Maximum number of snapshots to keep per file. Older entries are pruned
   * after each write. Defaults to 30 when not specified.
   */
  retentionPerFile?: number
}

/** Fallback cap used when {@link SnapshotConfig.retentionPerFile} is not set. */
const DEFAULT_RETENTION_PER_FILE = 30

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
  const maxPerFile = config?.retentionPerFile ?? DEFAULT_RETENTION_PER_FILE
  const stamps = await readStamps(dir)
  if (stamps.length <= maxPerFile) return
  const toRemove = stamps
    .sort((a, b) => a - b)
    .slice(0, stamps.length - maxPerFile)
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

/** Absolute path of a snapshot's label sidecar (`<dir>/<stamp>.label.txt`). */
function labelPathFor(dir: string, stamp: number): string {
  return path.join(dir, `${stamp}.label.txt`)
}

/** Read a snapshot's label sidecar (trimmed), or undefined when absent/empty. */
async function readLabel(
  dir: string,
  stamp: number,
): Promise<string | undefined> {
  try {
    const raw = await fs.readFile(labelPathFor(dir, stamp), 'utf8')
    const trimmed = raw.trim()
    return trimmed.length > 0 ? trimmed : undefined
  } catch {
    return undefined
  }
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
      label: await readLabel(dir, stamp),
      labelPath: labelPathFor(dir, stamp),
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
  const dir = path.join(config.root, resolved.hash)
  const originalPath = (await readOriginalPath(dir)) ?? ''
  const stat = await fs.stat(resolved.file).catch(() => null)
  const stamp = Number(id.split('/')[1])
  return {
    meta: {
      id,
      originalPath,
      fileName: path.basename(originalPath),
      timestamp: new Date(stamp).toISOString(),
      sizeBytes: stat?.size ?? content.length,
      label: await readLabel(dir, stamp),
      labelPath: labelPathFor(dir, stamp),
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
  if (!config) return null
  const snap = await readSnapshot(id)
  if (!snap || !snap.meta.originalPath) return null
  const target = snap.meta.originalPath

  // Defense-in-depth: `target` is read from on-disk meta.json. Refuse to write
  // it back if it escapes the allowed roots (a tampered meta can't redirect the
  // restore). An empty allow-list means "unconfigured" → fall back to allowing.
  const roots = config.allowedRoots ?? []
  if (roots.length > 0 && !roots.some((root) => isInsideRoot(target, root))) {
    return null
  }

  // Snapshot the current content (if any) so the restore is reversible.
  const current = await fs.readFile(target, 'utf8').catch(() => null)
  if (current !== null && current !== snap.content) {
    await recordSnapshot(target, current)
  }

  await fs.mkdir(path.dirname(target), { recursive: true })
  const tmp = uniqueTempPath(target)
  try {
    await fs.writeFile(tmp, snap.content, 'utf8')
  } catch (err) {
    if (isPermissionError(err)) throw new ConfigWriteError(target, err)
    if (isDiskError(err)) throw new ConfigDiskError(target, err)
    throw err
  }
  let renamed = false
  try {
    await fs.rename(tmp, target)
    renamed = true
  } catch (err) {
    if (isPermissionError(err)) throw new ConfigWriteError(target, err)
    if (isDiskError(err)) throw new ConfigDiskError(target, err)
    throw err
  } finally {
    // If the rename did not complete, the temp file was orphaned — remove it so
    // .abyss-tmp-* sidecars never accumulate next to live config files.
    if (!renamed) await fs.rm(tmp, { force: true })
  }
  return { success: true, path: target }
}

/**
 * Permanently delete a single snapshot: its `.snap` blob and the matching
 * `.label.txt` sidecar. Returns true when the snapshot existed and was removed.
 */
export async function deleteSnapshot(id: string): Promise<boolean> {
  const resolved = resolveSnapshot(id)
  if (!resolved || !config) return false
  const existed = await pathExists(resolved.file)
  await fs.rm(resolved.file, { force: true }).catch(() => undefined)
  const stamp = Number(id.split('/')[1])
  await fs
    .rm(labelPathFor(path.join(config.root, resolved.hash), stamp), {
      force: true,
    })
    .catch(() => undefined)
  return existed
}
