/**
 * Locating Sourcegraph Cody CLI's on-disk conversation store.
 *
 * Cody stores each AI conversation as a JSON file under:
 *   Linux/macOS: `~/.sourcegraph/cody/conversations/<session-id>.json`
 *   Windows:     `%APPDATA%\Sourcegraph\Cody\conversations\<session-id>.json`
 *
 * Each file contains a top-level object with a `messages` array using
 * Anthropic-compatible `{ role, content }` entries.
 */

import path from 'node:path'
import { promises as fs } from 'node:fs'
import type { Dirent } from 'node:fs'
import type { OsEnv } from '@/shared/types/agent'
import { pathExists } from '../../json-file'

/** Absolute path to the Cody config directory. */
export function codyConfigDir(env: OsEnv): string {
  return env.platform === 'win32'
    ? path.join(env.appData ?? env.home, 'Sourcegraph', 'Cody')
    : path.join(env.home, '.sourcegraph', 'cody')
}

/** Absolute path to the Cody conversations directory. */
export function codySessionsDir(env: OsEnv): string {
  return path.join(codyConfigDir(env), 'conversations')
}

/**
 * Enumerate every `*.json` file in the Cody conversations directory.
 * Each JSON file is one conversation/session.
 */
export async function listCodySessionFiles(env: OsEnv): Promise<string[]> {
  const root = codySessionsDir(env)
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
 * Derive the session id from a Cody conversation JSON file path.
 * The session id is the basename without the `.json` extension.
 */
export function codySessionId(filePath: string): string {
  return path.basename(filePath).replace(/\.json$/i, '')
}

/**
 * Resolve the absolute path of a session file given the session id.
 * Returns null when no matching file is found.
 */
export async function findCodySessionFile(
  env: OsEnv,
  sessionId: string,
): Promise<string | null> {
  const expected = path.join(codySessionsDir(env), `${sessionId}.json`)
  if (await pathExists(expected)) return expected
  return null
}
