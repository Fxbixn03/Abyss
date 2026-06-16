/**
 * Low-level filesystem helpers shared by every core module. Node-only.
 */

import { promises as fs } from 'node:fs'
import path from 'node:path'
import type { ZodType } from 'zod'
import { recordSnapshot } from './snapshots'
import { uniqueTempPath } from './tmp-path'
import {
  ConfigDiskError,
  ConfigNotFoundError,
  ConfigParseError,
  ConfigReadError,
  ConfigValidationError,
  ConfigWriteError,
} from './config-error'

/** Returns true when a Node.js filesystem error is a permission denial. */
function isPermissionError(err: unknown): boolean {
  if (err && typeof err === 'object') {
    const code = (err as Record<string, unknown>).code
    return code === 'EACCES' || code === 'EPERM'
  }
  return false
}

/** Returns true when a Node.js filesystem error indicates the path does not exist. */
function isNotFoundOsError(err: unknown): boolean {
  if (err && typeof err === 'object') {
    const code = (err as Record<string, unknown>).code
    return code === 'ENOENT'
  }
  return false
}

/** Returns true when a Node.js filesystem error is a disk-space or cross-device issue. */
function isDiskError(err: unknown): boolean {
  if (err && typeof err === 'object') {
    const code = (err as Record<string, unknown>).code
    return code === 'ENOSPC' || code === 'EXDEV'
  }
  return false
}

export async function pathExists(p: string): Promise<boolean> {
  try {
    await fs.access(p)
    return true
  } catch {
    return false
  }
}

export async function readTextFile(p: string): Promise<string> {
  try {
    return await fs.readFile(p, 'utf8')
  } catch (err) {
    if (isPermissionError(err)) throw new ConfigReadError(p, err)
    // ENOENT after the caller verified existence = TOCTOU race (file deleted
    // between the existence check and the actual read).
    if (isNotFoundOsError(err)) throw new ConfigNotFoundError(p, err)
    throw err
  }
}

export async function ensureDir(dir: string): Promise<void> {
  await fs.mkdir(dir, { recursive: true })
}

/** Write via a temp file + rename so a crash can't leave a half-written config. */
export async function writeTextFileAtomic(
  p: string,
  content: string,
): Promise<void> {
  await ensureDir(path.dirname(p))
  // Safety net: snapshot the previous content before overwriting (best-effort).
  if (await pathExists(p)) {
    const previous = await readTextFile(p).catch(() => null)
    if (previous !== null && previous !== content) {
      await recordSnapshot(p, previous)
    }
  }
  const tmp = uniqueTempPath(p)
  try {
    await fs.writeFile(tmp, content, 'utf8')
  } catch (err) {
    if (isPermissionError(err)) throw new ConfigWriteError(p, err)
    if (isDiskError(err)) throw new ConfigDiskError(p, err)
    throw err
  }
  let renamed = false
  try {
    await fs.rename(tmp, p)
    renamed = true
  } catch (err) {
    if (isPermissionError(err)) throw new ConfigWriteError(p, err)
    if (isDiskError(err)) throw new ConfigDiskError(p, err)
    throw err
  } finally {
    // If the rename did not complete, the temp file was orphaned — remove it so
    // .abyss-tmp-* sidecars never accumulate next to live config files.
    if (!renamed) await fs.rm(tmp, { force: true })
  }
}

/**
 * Read and parse a JSON config file. A missing or empty file yields `fallback`.
 *
 * Malformed JSON throws a typed {@link ConfigParseError} (carrying the path) so
 * the renderer can offer the raw-text repair flow instead of surfacing an
 * opaque `SyntaxError`. When a zod `schema` is given the parsed value is
 * validated, replacing the previous unchecked `as T` cast; a schema mismatch
 * throws {@link ConfigValidationError}.
 */
export async function readJsonFile<T>(
  p: string,
  fallback: T,
  schema?: ZodType<T>,
): Promise<T> {
  if (!(await pathExists(p))) return fallback
  const raw = await readTextFile(p)
  if (raw.trim() === '') return fallback

  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch (err) {
    throw new ConfigParseError(p, err)
  }

  if (schema) {
    const result = schema.safeParse(parsed)
    if (!result.success) {
      throw new ConfigValidationError(p, result.error.message, result.error)
    }
    return result.data
  }
  return parsed as T
}

/**
 * Serialize and write a value to a JSON config file atomically.
 *
 * When an optional zod `schema` is provided the value is validated with
 * `schema.safeParse` **before** serialization so a caller bug that introduces a
 * wrong shape is caught early with a typed {@link ConfigValidationError}
 * (carrying the file path) rather than going to disk silently.
 */
export async function writeJsonFile<T = unknown>(
  p: string,
  value: T,
  schema?: ZodType<T>,
): Promise<void> {
  if (schema) {
    const result = schema.safeParse(value)
    if (!result.success) {
      throw new ConfigValidationError(p, result.error.message, result.error)
    }
  }
  await writeTextFileAtomic(p, `${JSON.stringify(value, null, 2)}\n`)
}
