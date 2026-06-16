/**
 * Locating Cursor's on-disk chat store. Cursor (a VS Code fork) stores AI
 * conversation logs as JSONL files:
 *   Linux/macOS: ~/.cursor/logs/conversations/*.jsonl
 *   macOS (app-level): ~/Library/Application Support/Cursor/logs/conversations/*.jsonl
 *
 * We check the home-relative path first (cross-platform) then fall back to the
 * appData path Cursor uses on macOS.
 */

import path from 'node:path'
import { promises as fs } from 'node:fs'
import type { OsEnv } from '@/shared/types/agent'
import { pathExists } from '../../json-file'

/** Primary sessions directory: ~/.cursor/logs/conversations */
export function cursorSessionsDir(env: OsEnv): string {
  if (env.platform === 'darwin') {
    // On macOS Cursor stores logs under Application Support
    return path.join(
      env.appData,
      'Cursor',
      'logs',
      'conversations',
    )
  }
  // Linux (and Windows fallback via appData)
  return path.join(env.home, '.cursor', 'logs', 'conversations')
}

/** The ~/.cursor home dir (used by the availability check). */
export function cursorHomeDir(env: OsEnv): string {
  if (env.platform === 'darwin') {
    return path.join(env.appData, 'Cursor')
  }
  return path.join(env.home, '.cursor')
}

/** Enumerate every `*.jsonl` file directly under the sessions dir. */
export async function listCursorSessionFiles(env: OsEnv): Promise<string[]> {
  const root = cursorSessionsDir(env)
  if (!(await pathExists(root))) return []

  const entries = await fs.readdir(root, { withFileTypes: true })
  return entries
    .filter((e) => e.isFile() && e.name.toLowerCase().endsWith('.jsonl'))
    .map((e) => path.join(root, e.name))
}

/** Derive the session id from a file path (basename without extension). */
export function cursorSessionId(filePath: string): string {
  return path.basename(filePath).replace(/\.jsonl$/i, '')
}

export async function findCursorSessionFile(
  env: OsEnv,
  sessionId: string,
): Promise<string | null> {
  const expected = path.join(cursorSessionsDir(env), `${sessionId}.jsonl`)
  if (await pathExists(expected)) return expected
  return null
}
