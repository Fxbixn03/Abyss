/**
 * Locating Amazon Q Developer CLI's on-disk conversation store. Amazon Q CLI
 * stores each conversation under `~/.aws/amazonq/conversations/<uuid>.json`
 * where each file contains a `messages` array with Anthropic-compatible
 * `{ role, content }` entries.
 */

import path from 'node:path'
import { promises as fs } from 'node:fs'
import type { Dirent } from 'node:fs'
import type { OsEnv } from '@/shared/types/agent'
import { pathExists } from '../../json-file'

/** Absolute path to the Amazon Q conversations directory. */
export function amazonqSessionsDir(env: OsEnv): string {
  return path.join(env.home, '.aws', 'amazonq', 'conversations')
}

/**
 * Enumerate every `*.json` file in the Amazon Q conversations directory.
 * Each JSON file is one conversation session named with a UUID.
 */
export async function listAmazonqSessionFiles(
  env: OsEnv,
): Promise<string[]> {
  const root = amazonqSessionsDir(env)
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
export function amazonqSessionId(filePath: string): string {
  return path.basename(filePath).replace(/\.json$/i, '')
}

/**
 * Resolve the absolute path of a session file given the session id.
 * Returns null when no matching file is found.
 */
export async function findAmazonqSessionFile(
  env: OsEnv,
  sessionId: string,
): Promise<string | null> {
  const expected = path.join(amazonqSessionsDir(env), `${sessionId}.json`)
  if (await pathExists(expected)) return expected
  return null
}
