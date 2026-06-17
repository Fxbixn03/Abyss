/**
 * Locating Kiro (AWS)'s on-disk session store.
 *
 * Kiro stores each AI session as a JSON file under:
 *   `~/.kiro/sessions/<session-id>.json`
 *
 * Each file contains a top-level object with a `messages` array using
 * Anthropic-compatible `{ role, content }` entries (Kiro is built on Claude).
 */

import path from 'node:path'
import { promises as fs } from 'node:fs'
import type { Dirent } from 'node:fs'
import type { OsEnv } from '@/shared/types/agent'
import { pathExists } from '../../json-file'

/** Absolute path to the Kiro home directory. */
export function kiroHomeDir(env: OsEnv): string {
  return path.join(env.home, '.kiro')
}

/** Absolute path to the Kiro sessions directory. */
export function kiroSessionsDir(env: OsEnv): string {
  return path.join(env.home, '.kiro', 'sessions')
}

/**
 * Enumerate every `*.json` file in the Kiro sessions directory.
 * Each JSON file is one session.
 */
export async function listKiroSessionFiles(env: OsEnv): Promise<string[]> {
  const root = kiroSessionsDir(env)
  if (!(await pathExists(root))) return []

  let entries: Dirent[]
  try {
    entries = (await fs.readdir(root, { withFileTypes: true })) as Dirent[]
  } catch {
    return []
  }

  return entries
    .filter(
      (e) =>
        e.isFile() && (e.name as string).toLowerCase().endsWith('.json'),
    )
    .map((e) => path.join(root, e.name as string))
}

/**
 * Derive the session id from a Kiro session JSON file path.
 * The session id is the basename without the `.json` extension.
 */
export function kiroSessionId(filePath: string): string {
  return path.basename(filePath).replace(/\.json$/i, '')
}

/**
 * Resolve the absolute path of a session file given the session id.
 * Returns null when no matching file is found.
 */
export async function findKiroSessionFile(
  env: OsEnv,
  sessionId: string,
): Promise<string | null> {
  const expected = path.join(kiroSessionsDir(env), `${sessionId}.json`)
  if (await pathExists(expected)) return expected
  return null
}
