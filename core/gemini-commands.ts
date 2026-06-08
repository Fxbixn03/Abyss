/**
 * Read / write Gemini CLI custom slash commands. Each command is a single TOML
 * file under `<base>/commands/` (global `~/.gemini/commands/` or
 * `<project>/.gemini/commands/`), optionally nested in group folders —
 * `commands/git/commit.toml` → the `/git:commit` command. Top-level keys are
 * `name`, `description`, `prompt`.
 *
 * Like Codex subagents, this is TOML, so it gets its own IO instead of reusing
 * the markdown-collection mechanism. Writing persists the raw text verbatim
 * (the renderer re-serializes on form edits). Node-only. Ids are validated to a
 * safe charset (no path traversal) and may carry a nested POSIX group path.
 */

import path from 'node:path'
import { promises as fs } from 'node:fs'
import { parse } from 'smol-toml'
import type { GeminiCommandSummary } from '@/shared/types/gemini-command'
import {
  ensureDir,
  pathExists,
  readTextFile,
  writeTextFileAtomic,
} from './json-file'

/** Subdirectory (relative to the Gemini base) that holds slash commands. */
const COMMANDS_DIR = 'commands'
const SEGMENT_RE = /^[A-Za-z0-9._()-]+$/

function sanitizeId(id: string): string {
  const segments = id
    .replace(/\.toml$/i, '')
    .split(/[\\/]+/)
    .filter(Boolean)
  if (segments.length === 0) throw new Error(`Invalid Gemini command id: ${id}`)
  for (const seg of segments) {
    if (seg === '.' || seg === '..' || !SEGMENT_RE.test(seg)) {
      throw new Error(`Invalid Gemini command id: ${id}`)
    }
  }
  return segments.join('/')
}

function commandsDir(basePath: string): string {
  return path.join(basePath, COMMANDS_DIR)
}

function itemFilePath(basePath: string, id: string): string {
  const parts = sanitizeId(id).split('/')
  parts[parts.length - 1] += '.toml'
  return path.join(commandsDir(basePath), ...parts)
}

/** Default display name for a command: its id with `/` → `:` (e.g. git:commit). */
function defaultName(id: string): string {
  return id.split('/').join(':')
}

function asString(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined
}

async function collectToml(dir: string): Promise<string[]> {
  const out: string[] = []
  const entries = await fs.readdir(dir, { withFileTypes: true })
  for (const entry of entries) {
    if (entry.name.startsWith('.')) continue
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) out.push(...(await collectToml(full)))
    else if (entry.isFile() && entry.name.toLowerCase().endsWith('.toml')) {
      out.push(full)
    }
  }
  return out
}

export async function listGeminiCommands(
  basePath: string,
): Promise<GeminiCommandSummary[]> {
  const dir = commandsDir(basePath)
  if (!(await pathExists(dir))) return []

  const files = await collectToml(dir)
  const items: GeminiCommandSummary[] = []

  for (const filePath of files) {
    const id = path
      .relative(dir, filePath)
      .replace(/\.toml$/i, '')
      .split(path.sep)
      .join('/')

    let data: Record<string, unknown> = {}
    try {
      data = parse(await readTextFile(filePath)) as Record<string, unknown>
    } catch {
      // Malformed TOML still shows up in the list so the user can fix it.
    }

    items.push({
      id,
      name: asString(data.name) || defaultName(id),
      description: asString(data.description) || '',
      path: filePath,
    })
  }

  items.sort((a, b) => a.name.localeCompare(b.name))
  return items
}

export async function readGeminiCommand(
  basePath: string,
  id: string,
): Promise<{ raw: string; path: string }> {
  const filePath = itemFilePath(basePath, id)
  const raw = (await pathExists(filePath)) ? await readTextFile(filePath) : ''
  return { raw, path: filePath }
}

export async function writeGeminiCommand(
  basePath: string,
  id: string,
  content: string,
): Promise<{ success: boolean; path: string }> {
  const filePath = itemFilePath(basePath, id)
  await writeTextFileAtomic(filePath, content)
  return { success: true, path: filePath }
}

export async function deleteGeminiCommand(
  basePath: string,
  id: string,
): Promise<{ success: boolean }> {
  await fs.rm(itemFilePath(basePath, id), { force: true })
  return { success: true }
}

export async function renameGeminiCommand(
  basePath: string,
  fromId: string,
  toId: string,
): Promise<{ success: boolean; id: string; path: string }> {
  const from = sanitizeId(fromId)
  const to = sanitizeId(toId)
  if (from === to) {
    return { success: true, id: to, path: itemFilePath(basePath, to) }
  }
  const src = itemFilePath(basePath, from)
  const dest = itemFilePath(basePath, to)
  if (await pathExists(dest)) {
    throw new Error(`A Gemini command named "${to}" already exists.`)
  }
  await ensureDir(path.dirname(dest))
  await fs.rename(src, dest)
  return { success: true, id: to, path: dest }
}
