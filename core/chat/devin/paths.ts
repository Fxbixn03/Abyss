/**
 * Locating Devin CLI's on-disk conversation store.
 *
 * Devin CLI (Cognition AI) stores each conversation session as a JSON file under:
 *   `~/.devin/sessions/<session-id>.json`
 *
 * Each file contains a top-level object with a `messages` array using standard
 * `{ role, content }` entries.
 */

import path from 'node:path'
import { promises as fs } from 'node:fs'
import type { Dirent } from 'node:fs'
import type { OsEnv } from '@/shared/types/agent'
import { pathExists } from '../../json-file'

/** Absolute path to the Devin sessions directory. */
export function devinSessionsDir(env: OsEnv): string {
  return path.join(env.home, '.devin', 'sessions')
}

/**
 * Enumerate every `*.json` file in the Devin sessions directory.
 * Each JSON file is one conversation/session.
 */
export async function listDevinSessionFiles(env: OsEnv): Promise<string[]> {
  const root = devinSessionsDir(env)
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
 * Derive the session id from a Devin session JSON file path.
 * The session id is the basename without the `.json` extension.
 */
export function devinSessionId(filePath: string): string {
  return path.basename(filePath).replace(/\.json$/i, '')
}

/**
 * Resolve the absolute path of a session file given the session id.
 * Returns null when no matching file is found.
 */
export async function findDevinSessionFile(
  env: OsEnv,
  sessionId: string,
): Promise<string | null> {
  const expected = path.join(devinSessionsDir(env), `${sessionId}.json`)
  if (await pathExists(expected)) return expected
  return null
}
