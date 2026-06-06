/**
 * Locating OpenAI Codex's on-disk chat store. Rollout transcripts live under
 * `~/.codex/sessions/<YYYY>/<MM>/<DD>/rollout-*.jsonl`.
 */

import path from 'node:path'
import { promises as fs } from 'node:fs'
import type { OsEnv } from '@/shared/types/agent'
import { pathExists } from '../../json-file'

export function codexSessionsDir(env: OsEnv): string {
  return path.join(env.home, '.codex', 'sessions')
}

export function codexAuthFile(env: OsEnv): string {
  return path.join(env.home, '.codex', 'auth.json')
}

/** Recursively collect every `*.jsonl` rollout file under the sessions dir. */
export async function listCodexSessionFiles(env: OsEnv): Promise<string[]> {
  const root = codexSessionsDir(env)
  if (!(await pathExists(root))) return []

  const out: string[] = []
  async function walk(dir: string): Promise<void> {
    const entries = await fs.readdir(dir, { withFileTypes: true })
    for (const entry of entries) {
      const full = path.join(dir, entry.name)
      if (entry.isDirectory()) await walk(full)
      else if (entry.isFile() && entry.name.toLowerCase().endsWith('.jsonl')) {
        out.push(full)
      }
    }
  }
  await walk(root)
  return out
}

export function codexSessionId(filePath: string): string {
  return path.basename(filePath).replace(/\.jsonl$/i, '')
}

export async function findCodexSessionFile(
  env: OsEnv,
  sessionId: string,
): Promise<string | null> {
  const files = await listCodexSessionFiles(env)
  return files.find((f) => codexSessionId(f) === sessionId) ?? null
}
