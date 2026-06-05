/**
 * Low-level filesystem helpers shared by every core module. Node-only.
 */

import { promises as fs } from 'node:fs'
import path from 'node:path'

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
  const tmp = `${p}.abyss-tmp-${process.pid}`
  await fs.writeFile(tmp, content, 'utf8')
  await fs.rename(tmp, p)
}

export async function readJsonFile<T>(p: string, fallback: T): Promise<T> {
  if (!(await pathExists(p))) return fallback
  const raw = await readTextFile(p)
  if (raw.trim() === '') return fallback
  return JSON.parse(raw) as T
}

export async function writeJsonFile(p: string, value: unknown): Promise<void> {
  await writeTextFileAtomic(p, `${JSON.stringify(value, null, 2)}\n`)
}
