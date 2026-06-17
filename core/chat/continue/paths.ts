/**
 * Locating Continue's on-disk chat history store.
 *
 * Continue stores each conversation as a JSON file under:
 *   `~/.continue/history/<session-id>.json`
 *
 * Each file contains a `messages` array (Anthropic-compatible `{ role, content }`)
 * and a `title` field at the top level.
 */

import path from 'node:path'
import { promises as fs } from 'node:fs'
import type { Dirent } from 'node:fs'
import type { OsEnv } from '@/shared/types/agent'
import { pathExists } from '../../json-file'

/** Absolute path to the Continue history directory. */
export function continueSessionsDir(env: OsEnv): string {
  return path.join(env.home, '.continue', 'history')
}

/**
 * Enumerate every `*.json` file in the Continue history directory.
 * Each JSON file is one conversation session.
 */
export async function listContinueSessionFiles(env: OsEnv): Promise<string[]> {
  const root = continueSessionsDir(env)
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
 * Derive the session id from a Continue session JSON file path.
 * The session id is the basename without the `.json` extension.
 */
export function continueSessionId(filePath: string): string {
  return path.basename(filePath).replace(/\.json$/i, '')
}

/**
 * Resolve the absolute path of a session file given the session id.
 * Returns null when no matching file is found.
 */
export async function findContinueSessionFile(
  env: OsEnv,
  sessionId: string,
): Promise<string | null> {
  const expected = path.join(continueSessionsDir(env), `${sessionId}.json`)
  if (await pathExists(expected)) return expected
  return null
}
