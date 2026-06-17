/**
 * Locating Warp terminal's AI session store. Warp 2025+ stores each AI
 * conversation as a JSONL file at:
 *   Linux/macOS: `~/.warp/warp-ai/sessions/<session-id>.jsonl`
 *   Windows:     `%APPDATA%\warp\warp-ai\sessions\<session-id>.jsonl`
 *
 * Each line in the JSONL file is a JSON event with `role` and
 * Anthropic-compatible `content`.
 */

import path from 'node:path'
import { promises as fs } from 'node:fs'
import type { Dirent } from 'node:fs'
import type { OsEnv } from '@/shared/types/agent'
import { pathExists } from '../../json-file'

/** Absolute path to the Warp AI sessions directory. */
export function warpSessionsDir(env: OsEnv): string {
  if (env.platform === 'win32') {
    return path.join(env.appData, 'warp', 'warp-ai', 'sessions')
  }
  return path.join(env.home, '.warp', 'warp-ai', 'sessions')
}

/**
 * Enumerate every `*.jsonl` file in the Warp AI sessions directory.
 * Each JSONL file is one AI conversation session.
 */
export async function listWarpSessionFiles(env: OsEnv): Promise<string[]> {
  const root = warpSessionsDir(env)
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
 * Derive the session id from a Warp session JSONL file path. The session id is
 * the basename without the `.jsonl` extension (typically a UUID or timestamp).
 */
export function warpSessionId(filePath: string): string {
  return path.basename(filePath).replace(/\.jsonl$/i, '')
}

/**
 * Resolve the absolute path of a session file given the session id.
 * Returns null when no matching file is found.
 */
export async function findWarpSessionFile(
  env: OsEnv,
  sessionId: string,
): Promise<string | null> {
  const expected = path.join(warpSessionsDir(env), `${sessionId}.jsonl`)
  if (await pathExists(expected)) return expected
  return null
}
