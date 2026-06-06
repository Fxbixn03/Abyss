/**
 * Locating Claude Code's on-disk chat store. Sessions live as JSONL files under
 * `~/.claude/projects/<encoded-cwd>/<sessionId>.jsonl`.
 */

import path from 'node:path'
import { promises as fs } from 'node:fs'
import type { OsEnv } from '@/shared/types/agent'
import { pathExists } from '../../json-file'

export function claudeProjectsDir(env: OsEnv): string {
  return path.join(env.home, '.claude', 'projects')
}

/** Decode a project folder name (path separators encoded as dashes) → cwd. */
export function decodeProjectDir(name: string): string {
  if (!name.startsWith('-')) return name.replace(/-/g, '/')
  return `/${name.slice(1).replace(/-/g, '/')}`
}

/** All `*.jsonl` session files across every project folder. */
export async function listClaudeSessionFiles(
  env: OsEnv,
): Promise<{ filePath: string; projectDir: string }[]> {
  const root = claudeProjectsDir(env)
  if (!(await pathExists(root))) return []

  const out: { filePath: string; projectDir: string }[] = []
  const projects = await fs.readdir(root, { withFileTypes: true })
  for (const project of projects) {
    if (!project.isDirectory()) continue
    const dir = path.join(root, project.name)
    const files = await fs.readdir(dir, { withFileTypes: true })
    for (const file of files) {
      if (file.isFile() && file.name.toLowerCase().endsWith('.jsonl')) {
        out.push({
          filePath: path.join(dir, file.name),
          projectDir: project.name,
        })
      }
    }
  }
  return out
}

/** Resolve the backing file for a session id, or null if not found. */
export async function findClaudeSessionFile(
  env: OsEnv,
  sessionId: string,
): Promise<{ filePath: string; projectDir: string } | null> {
  const files = await listClaudeSessionFiles(env)
  const base = `${sessionId}.jsonl`
  return files.find((f) => path.basename(f.filePath) === base) ?? null
}
