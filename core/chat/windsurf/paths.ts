/**
 * Locating Windsurf's on-disk conversation store. Windsurf (Codeium) stores
 * each conversation as a JSON file at:
 *   `~/.codeium/windsurf/conversations/<uuid>.json`
 *
 * Each JSON file contains a `messages` array with Anthropic-compatible
 * `{ role, content }` entries.
 */

import path from 'node:path'
import { promises as fs } from 'node:fs'
import type { Dirent } from 'node:fs'
import type { OsEnv } from '@/shared/types/agent'
import { pathExists } from '../../json-file'

/** Absolute path to the Windsurf conversations directory. */
export function windsurfSessionsDir(env: OsEnv): string {
  return path.join(env.home, '.codeium', 'windsurf', 'conversations')
}

/**
 * Enumerate every `*.json` file in the Windsurf conversations directory.
 * Each JSON file is one conversation session named with a UUID.
 */
export async function listWindsurfSessionFiles(
  env: OsEnv,
): Promise<string[]> {
  const root = windsurfSessionsDir(env)
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
        e.isFile() &&
        (e.name as string).toLowerCase().endsWith('.json'),
    )
    .map((e) => path.join(root, e.name as string))
}

/**
 * Derive the session id from a conversation JSON file path. The session id is
 * the basename without the `.json` extension (typically a UUID).
 */
export function windsurfSessionId(filePath: string): string {
  return path.basename(filePath).replace(/\.json$/i, '')
}

/**
 * Resolve the absolute path of a session file given the session id.
 * Returns null when no matching file is found.
 */
export async function findWindsurfSessionFile(
  env: OsEnv,
  sessionId: string,
): Promise<string | null> {
  const expected = path.join(windsurfSessionsDir(env), `${sessionId}.json`)
  if (await pathExists(expected)) return expected
  return null
}
