/**
 * Locating Cline's on-disk task store. Cline stores each task's conversation
 * under `~/Documents/Cline/tasks/<task-id>/api_conversation_history.json` as
 * an Anthropic-compatible JSON array of `{ role, content }` objects.
 *
 * Each task directory is a UUID-like string (e.g. `1718193600000`). The
 * conversation file is always named `api_conversation_history.json`.
 */

import path from 'node:path'
import { promises as fs } from 'node:fs'
import type { Dirent } from 'node:fs'
import type { OsEnv } from '@/shared/types/agent'
import { pathExists } from '../../json-file'

/** Absolute path to the Cline tasks directory. */
export function clineTasksDir(env: OsEnv): string {
  return path.join(env.home, 'Documents', 'Cline', 'tasks')
}

/** The filename Cline uses for its conversation history within each task dir. */
export const CLINE_HISTORY_FILENAME = 'api_conversation_history.json'

/**
 * Enumerate every `api_conversation_history.json` file in immediate
 * subdirectories of the Cline tasks dir. Each subdirectory corresponds to one
 * task (conversation).
 */
export async function listClineSessionFiles(env: OsEnv): Promise<string[]> {
  const root = clineTasksDir(env)
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
    const candidate = path.join(root, entry.name as string, CLINE_HISTORY_FILENAME)
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
export function clineSessionId(filePath: string): string {
  return path.basename(path.dirname(filePath))
}

/**
 * Find the conversation history file for a given session id. Returns null if
 * the file does not exist (e.g. the task was deleted externally).
 */
export async function findClineSessionFile(
  env: OsEnv,
  sessionId: string,
): Promise<string | null> {
  const expected = path.join(
    clineTasksDir(env),
    sessionId,
    CLINE_HISTORY_FILENAME,
  )
  if (await pathExists(expected)) return expected
  return null
}
