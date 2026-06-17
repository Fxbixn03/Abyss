/**
 * Locating Plandex CLI's on-disk conversation store. Plandex v2 stores each
 * plan under `~/.plandex/plans/<plan-dir>/` where each plan directory contains
 * a `conversation.jsonl` file with JSON-lines events.
 */

import path from 'node:path'
import { promises as fs } from 'node:fs'
import type { Dirent } from 'node:fs'
import type { OsEnv } from '@/shared/types/agent'
import { pathExists } from '../../json-file'

/** Absolute path to the Plandex home directory. */
export function plandexHomeDir(env: OsEnv): string {
  return path.join(env.home, '.plandex')
}

/** Absolute path to the Plandex plans directory. */
export function plandexSessionsDir(env: OsEnv): string {
  return path.join(env.home, '.plandex', 'plans')
}

/** The filename Plandex uses for its conversation history within each plan dir. */
export const PLANDEX_CONVERSATION_FILENAME = 'conversation.jsonl'

/**
 * Enumerate every `conversation.jsonl` file in immediate subdirectories of the
 * Plandex plans dir. Each subdirectory corresponds to one plan (conversation).
 */
export async function listPlandexSessionFiles(env: OsEnv): Promise<string[]> {
  const root = plandexSessionsDir(env)
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
    const candidate = path.join(
      root,
      entry.name as string,
      PLANDEX_CONVERSATION_FILENAME,
    )
    if (await pathExists(candidate)) {
      results.push(candidate)
    }
  }
  return results
}

/**
 * Derive the session id from a conversation JSONL file path. The session id is
 * the name of the parent plan directory.
 */
export function plandexSessionId(filePath: string): string {
  return path.basename(path.dirname(filePath))
}

/**
 * Find the conversation JSONL file for a given session id. Returns null if the
 * file does not exist (e.g. the plan was deleted externally).
 */
export async function findPlandexSessionFile(
  env: OsEnv,
  sessionId: string,
): Promise<string | null> {
  const expected = path.join(
    plandexSessionsDir(env),
    sessionId,
    PLANDEX_CONVERSATION_FILENAME,
  )
  if (await pathExists(expected)) return expected
  return null
}
