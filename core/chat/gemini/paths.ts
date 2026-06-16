/**
 * Locating Gemini CLI's on-disk chat store. Sessions live as JSONL files under
 * `~/.gemini/sessions/<session-id>.jsonl` (one file per conversation).
 */

import path from 'node:path'
import { promises as fs } from 'node:fs'
import type { OsEnv } from '@/shared/types/agent'
import { pathExists } from '../../json-file'

export function geminiSessionsDir(env: OsEnv): string {
  return path.join(env.home, '.gemini', 'sessions')
}

export function geminiHomeDir(env: OsEnv): string {
  return path.join(env.home, '.gemini')
}

/** Enumerate every `*.jsonl` file directly under the sessions dir. */
export async function listGeminiSessionFiles(env: OsEnv): Promise<string[]> {
  const root = geminiSessionsDir(env)
  if (!(await pathExists(root))) return []

  const entries = await fs.readdir(root, { withFileTypes: true })
  return entries
    .filter((e) => e.isFile() && e.name.toLowerCase().endsWith('.jsonl'))
    .map((e) => path.join(root, e.name))
}

export function geminiSessionId(filePath: string): string {
  return path.basename(filePath).replace(/\.jsonl$/i, '')
}

export async function findGeminiSessionFile(
  env: OsEnv,
  sessionId: string,
): Promise<string | null> {
  const expected = path.join(geminiSessionsDir(env), `${sessionId}.jsonl`)
  if (await pathExists(expected)) return expected
  return null
}
