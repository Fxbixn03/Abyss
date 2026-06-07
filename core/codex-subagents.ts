/**
 * Read / write OpenAI Codex custom subagents. Each agent is a single TOML file
 * in `<base>/agents/` (global `~/.codex/agents/` or `<project>/.codex/agents/`),
 * with top-level keys `name`, `description`, `developer_instructions` (+ optional
 * `model`, `sandbox_mode`, `model_reasoning_effort`, `nickname_candidates`, and
 * inherited config keys). Unlike Claude's markdown subagents, this is TOML — so
 * it gets its own IO rather than reusing the markdown-collection mechanism.
 *
 * Writing re-serializes only on the renderer side (form edits); here we persist
 * the raw text verbatim. Node-only. Item ids are validated to a safe charset.
 */

import path from 'node:path'
import { promises as fs } from 'node:fs'
import { parse } from 'smol-toml'
import type { CodexSubagentSummary } from '@/shared/types/codex-subagent'
import { pathExists, readTextFile, writeTextFileAtomic } from './json-file'

/** Subdirectory (relative to the Codex base) that holds custom agents. */
const AGENTS_DIR = 'agents'

function sanitizeId(id: string): string {
  const base = path.basename(id).replace(/\.toml$/i, '')
  if (!/^[A-Za-z0-9._()-]+$/.test(base)) {
    throw new Error(`Invalid Codex subagent id: ${id}`)
  }
  return base
}

function agentsDir(basePath: string): string {
  return path.join(basePath, AGENTS_DIR)
}

function itemFilePath(basePath: string, id: string): string {
  return path.join(agentsDir(basePath), `${sanitizeId(id)}.toml`)
}

function asString(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined
}

export async function listCodexSubagents(
  basePath: string,
): Promise<CodexSubagentSummary[]> {
  const dir = agentsDir(basePath)
  if (!(await pathExists(dir))) return []

  const entries = await fs.readdir(dir, { withFileTypes: true })
  const items: CodexSubagentSummary[] = []

  for (const entry of entries) {
    if (entry.name.startsWith('.')) continue
    if (!entry.isFile() || !entry.name.toLowerCase().endsWith('.toml')) continue

    const id = entry.name.replace(/\.toml$/i, '')
    const filePath = path.join(dir, entry.name)

    let data: Record<string, unknown> = {}
    try {
      data = parse(await readTextFile(filePath)) as Record<string, unknown>
    } catch {
      // Malformed TOML still shows up in the list so the user can fix it.
    }

    items.push({
      id,
      name: asString(data.name) || id,
      description: asString(data.description) || '',
      model: asString(data.model),
      sandboxMode: asString(data.sandbox_mode),
      path: filePath,
    })
  }

  items.sort((a, b) => a.name.localeCompare(b.name))
  return items
}

export async function readCodexSubagent(
  basePath: string,
  id: string,
): Promise<{ raw: string; path: string }> {
  const filePath = itemFilePath(basePath, id)
  const raw = (await pathExists(filePath)) ? await readTextFile(filePath) : ''
  return { raw, path: filePath }
}

export async function writeCodexSubagent(
  basePath: string,
  id: string,
  content: string,
): Promise<{ success: boolean; path: string }> {
  const filePath = itemFilePath(basePath, id)
  await writeTextFileAtomic(filePath, content)
  return { success: true, path: filePath }
}

export async function deleteCodexSubagent(
  basePath: string,
  id: string,
): Promise<{ success: boolean }> {
  await fs.rm(itemFilePath(basePath, id), { force: true })
  return { success: true }
}

export async function renameCodexSubagent(
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
    throw new Error(`A Codex subagent named "${to}" already exists.`)
  }
  await fs.rename(src, dest)
  return { success: true, id: to, path: dest }
}
