/**
 * Low-level filesystem helpers shared by every core module. Node-only.
 */

import { promises as fs } from 'node:fs'
import path from 'node:path'
import type { ZodType } from 'zod'
import { recordSnapshot } from './snapshots'
import { ConfigParseError, ConfigValidationError } from './config-error'

export async function pathExists(p: string): Promise<boolean> {
  try {
    await fs.access(p)
    return true
  } catch {
    return false
  }
}

export async function readTextFile(p: string): Promise<string> {
  return fs.readFile(p, 'utf8')
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
  const tmp = `${p}.abyss-tmp-${process.pid}`
  await fs.writeFile(tmp, content, 'utf8')
  await fs.rename(tmp, p)
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

export async function writeJsonFile(p: string, value: unknown): Promise<void> {
  await writeTextFileAtomic(p, `${JSON.stringify(value, null, 2)}\n`)
}
