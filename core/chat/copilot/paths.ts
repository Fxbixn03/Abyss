/**
 * Locating GitHub Copilot CLI's on-disk conversation store.
 *
 * Copilot CLI stores each conversation as a JSON file under:
 *   `~/.copilot/conversations/<session-id>.json`
 *
 * Each file contains a top-level object with a `messages` array using the
 * standard OpenAI role/content shape (compatible with `blocksFromAnthropicContent`).
 */

import path from 'node:path'
import { promises as fs } from 'node:fs'
import type { Dirent } from 'node:fs'
import type { OsEnv } from '@/shared/types/agent'
import { pathExists } from '../../json-file'

/** Absolute path to the Copilot CLI conversations directory. */
export function copilotSessionsDir(env: OsEnv): string {
  return path.join(env.home, '.copilot', 'conversations')
}

/**
 * Enumerate every `*.json` file in the Copilot conversations directory.
 * Each JSON file is one conversation session.
 */
export async function listCopilotSessionFiles(env: OsEnv): Promise<string[]> {
  const root = copilotSessionsDir(env)
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
 * Derive the session id from a Copilot session JSON file path.
 * The session id is the basename without the `.json` extension.
 */
export function copilotSessionId(filePath: string): string {
  return path.basename(filePath).replace(/\.json$/i, '')
}

/**
 * Resolve the absolute path of a session file given the session id.
 * Returns null when no matching file is found.
 */
export async function findCopilotSessionFile(
  env: OsEnv,
  sessionId: string,
): Promise<string | null> {
  const expected = path.join(copilotSessionsDir(env), `${sessionId}.json`)
  if (await pathExists(expected)) return expected
  return null
}
