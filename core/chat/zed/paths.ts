/**
 * Locating Zed Editor's on-disk AI Panel conversation store.
 *
 * Zed stores each AI Panel session as a JSONL file under:
 *   Linux/macOS: `~/.config/zed/conversations/<uuid>.jsonl`
 *   Windows:     `%APPDATA%\Zed\conversations\<uuid>.jsonl`
 *
 * Each line in the JSONL file is an Anthropic-compatible `{ role, content }`
 * message object.
 */

import path from 'node:path'
import { promises as fs } from 'node:fs'
import type { Dirent } from 'node:fs'
import type { OsEnv } from '@/shared/types/agent'
import { pathExists } from '../../json-file'

/** Absolute path to the Zed conversations directory. */
export function zedSessionsDir(env: OsEnv): string {
  return env.platform === 'win32'
    ? path.join(env.appData ?? env.home, 'Zed', 'conversations')
    : path.join(env.home, '.config', 'zed', 'conversations')
}

/**
 * Enumerate every `*.jsonl` file in the Zed conversations directory.
 * Each JSONL file is one AI Panel conversation session.
 */
export async function listZedSessionFiles(env: OsEnv): Promise<string[]> {
  const root = zedSessionsDir(env)
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
        e.isFile() && (e.name as string).toLowerCase().endsWith('.jsonl'),
    )
    .map((e) => path.join(root, e.name as string))
}

/**
 * Derive the session id from a Zed conversation JSONL file path.
 * The session id is the basename without the `.jsonl` extension.
 */
export function zedSessionId(filePath: string): string {
  return path.basename(filePath).replace(/\.jsonl$/i, '')
}

/**
 * Resolve the absolute path of a session file given the session id.
 * Returns null when no matching file is found.
 */
export async function findZedSessionFile(
  env: OsEnv,
  sessionId: string,
): Promise<string | null> {
  const expected = path.join(zedSessionsDir(env), `${sessionId}.jsonl`)
  if (await pathExists(expected)) return expected
  return null
}
