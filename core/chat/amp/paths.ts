/**
 * Locating Amp (Sourcegraph)'s on-disk conversation store.
 *
 * Amp stores each conversation as a JSON file under:
 *   `~/.amp/conversations/<session-id>.json`
 *
 * Each file contains a top-level object with a `messages` array using
 * Anthropic-compatible `{ role, content }` entries.
 */

import path from 'node:path'
import { promises as fs } from 'node:fs'
import type { Dirent } from 'node:fs'
import type { OsEnv } from '@/shared/types/agent'
import { pathExists } from '../../json-file'

/** Absolute path to the Amp home directory. */
export function ampHomeDir(env: OsEnv): string {
  return path.join(env.home, '.amp')
}

/** Absolute path to the Amp conversations directory. */
export function ampSessionsDir(env: OsEnv): string {
  return path.join(env.home, '.amp', 'conversations')
}

/**
 * Enumerate every `*.json` file in the Amp conversations directory.
 * Each JSON file is one conversation session.
 */
export async function listAmpSessionFiles(env: OsEnv): Promise<string[]> {
  const root = ampSessionsDir(env)
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
 * Derive the session id from an Amp session JSON file path.
 * The session id is the basename without the `.json` extension.
 */
export function ampSessionId(filePath: string): string {
  return path.basename(filePath).replace(/\.json$/i, '')
}

/**
 * Resolve the absolute path of a session file given the session id.
 * Returns null when no matching file is found.
 */
export async function findAmpSessionFile(
  env: OsEnv,
  sessionId: string,
): Promise<string | null> {
  const expected = path.join(ampSessionsDir(env), `${sessionId}.json`)
  if (await pathExists(expected)) return expected
  return null
}
