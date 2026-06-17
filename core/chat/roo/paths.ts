/**
 * Locating Roo Code's on-disk task store. Roo Code is a Cline fork and stores
 * each task's conversation under `~/.roo/tasks/<task-id>/api_conversation_history.json`
 * (Linux/macOS) or `%APPDATA%\roo\tasks\<task-id>\api_conversation_history.json`
 * (Windows) as an Anthropic-compatible JSON array of `{ role, content }` objects.
 *
 * Each task directory is a timestamp-derived string (e.g. `1718193600000`). The
 * conversation file is always named `api_conversation_history.json`.
 */

import path from 'node:path'
import { promises as fs } from 'node:fs'
import type { Dirent } from 'node:fs'
import type { OsEnv } from '@/shared/types/agent'
import { pathExists } from '../../json-file'

/** Absolute path to the Roo Code tasks directory. */
export function rooTasksDir(env: OsEnv): string {
  if (env.platform === 'win32') {
    return path.join(env.appData, 'roo', 'tasks')
  }
  return path.join(env.home, '.roo', 'tasks')
}

/** The filename Roo Code uses for its conversation history within each task dir. */
export const ROO_HISTORY_FILENAME = 'api_conversation_history.json'

/**
 * Enumerate every `api_conversation_history.json` file in immediate
 * subdirectories of the Roo Code tasks dir. Each subdirectory corresponds to
 * one task (conversation).
 */
export async function listRooSessionFiles(env: OsEnv): Promise<string[]> {
  const root = rooTasksDir(env)
  if (!(await pathExists(root))) return []

  let entries: Dirent[]
  try {
    entries = (await fs.readdir(root, { withFileTypes: true })) as Dirent[]
  } catch {
    return []
  }

  const results: string[] = []
  for (const entry of entries) {
    if (!entry.isDirectory()) continue
    const candidate = path.join(root, entry.name as string, ROO_HISTORY_FILENAME)
    if (await pathExists(candidate)) {
      results.push(candidate)
    }
  }
  return results
}

/**
 * Derive the session id from a conversation history file path. The session id
 * is the name of the parent task directory.
 */
export function rooSessionId(filePath: string): string {
  return path.basename(path.dirname(filePath))
}

/**
 * Find the conversation history file for a given session id. Returns null if
 * the file does not exist (e.g. the task was deleted externally).
 */
export async function findRooSessionFile(
  env: OsEnv,
  sessionId: string,
): Promise<string | null> {
  const expected = path.join(
    rooTasksDir(env),
    sessionId,
    ROO_HISTORY_FILENAME,
  )
  if (await pathExists(expected)) return expected
  return null
}
