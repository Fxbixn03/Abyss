/**
 * Locating Goose's on-disk session store. Goose (Block) stores sessions as
 * JSONL files under `~/.config/goose/sessions/<session-id>.jsonl` on Linux/macOS
 * and `%APPDATA%\goose\sessions\` on Windows.
 */

import path from 'node:path'
import { promises as fs } from 'node:fs'
import type { OsEnv } from '@/shared/types/agent'
import { pathExists } from '../../json-file'

/** Absolute path to the Goose sessions directory. */
export function gooseSessionsDir(env: OsEnv): string {
  if (env.platform === 'win32') {
    return path.join(env.appData, 'goose', 'sessions')
  }
  return path.join(env.home, '.config', 'goose', 'sessions')
}

/** Absolute path to the Goose config base directory (one level above sessions). */
export function gooseBaseDir(env: OsEnv): string {
  if (env.platform === 'win32') {
    return path.join(env.appData, 'goose')
  }
  return path.join(env.home, '.config', 'goose')
}

/** Enumerate every `*.jsonl` file directly under the Goose sessions dir. */
export async function listGooseSessionFiles(env: OsEnv): Promise<string[]> {
  const root = gooseSessionsDir(env)
  if (!(await pathExists(root))) return []

  const entries = await fs.readdir(root, { withFileTypes: true })
  return entries
    .filter((e) => e.isFile() && e.name.toLowerCase().endsWith('.jsonl'))
    .map((e) => path.join(root, e.name))
}

/** Derive the session id from a JSONL file path (strip the `.jsonl` extension). */
export function gooseSessionId(filePath: string): string {
  return path.basename(filePath).replace(/\.jsonl$/i, '')
}

/**
 * Find the JSONL file for a given session id. Returns null if the file does not
 * exist (e.g. it was deleted externally).
 */
export async function findGooseSessionFile(
  env: OsEnv,
  sessionId: string,
): Promise<string | null> {
  const expected = path.join(gooseSessionsDir(env), `${sessionId}.jsonl`)
  if (await pathExists(expected)) return expected
  return null
}
