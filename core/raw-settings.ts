/**
 * Read / write raw settings files (`settings.json`, `settings.local.json`) as
 * text. Node-only. The filename is checked against an allowlist so this can't
 * be used to read/write arbitrary files.
 */

import path from 'node:path'
import type { RawSettingsFile } from '@/shared/types/ipc'
import { pathExists, readTextFile, writeTextFileAtomic } from './json-file'

const ALLOWED: ReadonlySet<string> = new Set([
  'settings.json',
  'settings.local.json',
])

function resolve(basePath: string, file: RawSettingsFile): string {
  if (!ALLOWED.has(file)) {
    throw new Error(`Not an allowed settings file: ${file}`)
  }
  return path.join(basePath, file)
}

export async function readRawSettings(
  basePath: string,
  file: RawSettingsFile,
): Promise<{ content: string; exists: boolean; path: string }> {
  const p = resolve(basePath, file)
  const exists = await pathExists(p)
  return { content: exists ? await readTextFile(p) : '', exists, path: p }
}

export async function writeRawSettings(
  basePath: string,
  file: RawSettingsFile,
  content: string,
): Promise<{ success: boolean; path: string }> {
  const p = resolve(basePath, file)
  await writeTextFileAtomic(p, content)
  return { success: true, path: p }
}
