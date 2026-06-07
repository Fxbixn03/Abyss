/**
 * Read / write Claude Code markdown collections: subagents (`agents/*.md`),
 * slash commands (`commands/*.md`) and skills (`skills/<name>/SKILL.md`).
 * Node-only. Item ids are validated to a safe charset (no path traversal).
 */

import path from 'node:path'
import { promises as fs } from 'node:fs'
import type { CollectionItem, CollectionKind } from '@/shared/types/collections'
import { collectionDirName } from '@/shared/agents/defs'
import { pathExists, readTextFile, writeTextFileAtomic } from './json-file'
import { parseFrontmatter } from './frontmatter'
import { writeZip } from './zip'

function sanitizeId(id: string): string {
  const base = path.basename(id).replace(/\.md$/i, '')
  // Parentheses are allowed so imported skill copies (`name(1)`) stay editable.
  if (!/^[A-Za-z0-9._()-]+$/.test(base)) {
    throw new Error(`Invalid collection item id: ${id}`)
  }
  return base
}

/** Absolute collection directory, honouring per-agent overrides (Codex → prompts). */
function collectionDir(
  agentId: string,
  basePath: string,
  kind: CollectionKind,
): string {
  return path.join(basePath, collectionDirName(agentId, kind))
}

function itemFilePath(
  agentId: string,
  basePath: string,
  kind: CollectionKind,
  id: string,
): string {
  const safe = sanitizeId(id)
  if (kind === 'skills') {
    return path.join(
      collectionDir(agentId, basePath, 'skills'),
      safe,
      'SKILL.md',
    )
  }
  return path.join(collectionDir(agentId, basePath, kind), `${safe}.md`)
}

export async function listCollection(
  agentId: string,
  basePath: string,
  kind: CollectionKind,
): Promise<CollectionItem[]> {
  const dir = collectionDir(agentId, basePath, kind)
  if (!(await pathExists(dir))) return []

  const entries = await fs.readdir(dir, { withFileTypes: true })
  const items: CollectionItem[] = []

  for (const entry of entries) {
    // Skip dotfiles/dirs — e.g. Codex's managed `skills/.system` bundle.
    if (entry.name.startsWith('.')) continue

    let id: string
    let filePath: string

    if (kind === 'skills') {
      if (!entry.isDirectory()) continue
      id = entry.name
      filePath = path.join(dir, entry.name, 'SKILL.md')
      if (!(await pathExists(filePath))) continue
    } else {
      if (!entry.isFile() || !entry.name.toLowerCase().endsWith('.md')) continue
      id = entry.name.replace(/\.md$/i, '')
      filePath = path.join(dir, entry.name)
    }

    const { data } = parseFrontmatter(await readTextFile(filePath))
    items.push({
      id,
      name: data.name || id,
      description: data.description || '',
      model: data.model,
      tools: data.tools,
      path: filePath,
    })
  }

  items.sort((a, b) => a.name.localeCompare(b.name))
  return items
}

export async function readCollectionItem(
  agentId: string,
  basePath: string,
  kind: CollectionKind,
  id: string,
): Promise<{ content: string; path: string }> {
  const filePath = itemFilePath(agentId, basePath, kind, id)
  const content = (await pathExists(filePath))
    ? await readTextFile(filePath)
    : ''
  return { content, path: filePath }
}

export async function writeCollectionItem(
  agentId: string,
  basePath: string,
  kind: CollectionKind,
  id: string,
  content: string,
): Promise<{ success: boolean; path: string }> {
  const filePath = itemFilePath(agentId, basePath, kind, id)
  await writeTextFileAtomic(filePath, content)
  return { success: true, path: filePath }
}

/**
 * Convert an item from one collection kind to another (skill <-> command),
 * keeping the same id. The source's markdown (frontmatter + body) is written to
 * the target location, then the source is deleted. Fails if the source is empty
 * or a target with the same id already exists, so nothing is overwritten.
 *
 * Note: only the markdown file moves — files bundled alongside a skill
 * (`SKILL.md` siblings) are not carried into a flat command file.
 */
export async function migrateCollectionItem(
  agentId: string,
  basePath: string,
  fromKind: CollectionKind,
  toKind: CollectionKind,
  id: string,
): Promise<{ success: boolean; id: string; path: string }> {
  if (fromKind === toKind) {
    throw new Error('Source and target collection are the same.')
  }
  const safe = sanitizeId(id)
  const targetPath = itemFilePath(agentId, basePath, toKind, safe)
  if (await pathExists(targetPath)) {
    throw new Error(`A ${toKind} item named "${safe}" already exists.`)
  }

  const { content } = await readCollectionItem(
    agentId,
    basePath,
    fromKind,
    safe,
  )
  if (!content.trim()) {
    throw new Error(`The ${fromKind} item "${safe}" has no content to migrate.`)
  }

  await writeCollectionItem(agentId, basePath, toKind, safe, content)
  await deleteCollectionItem(agentId, basePath, fromKind, safe)
  return { success: true, id: safe, path: targetPath }
}

export async function deleteCollectionItem(
  agentId: string,
  basePath: string,
  kind: CollectionKind,
  id: string,
): Promise<{ success: boolean }> {
  const safe = sanitizeId(id)
  const dir = collectionDir(agentId, basePath, kind)
  if (kind === 'skills') {
    // A skill is a folder; remove it (and its references) entirely.
    await fs.rm(path.join(dir, safe), {
      recursive: true,
      force: true,
    })
  } else {
    await fs.rm(path.join(dir, `${safe}.md`), { force: true })
  }
  return { success: true }
}

/** Rename an item to a new id within the same collection. */
export async function renameCollectionItem(
  agentId: string,
  basePath: string,
  kind: CollectionKind,
  fromId: string,
  toId: string,
): Promise<{ success: boolean; id: string; path: string }> {
  const from = sanitizeId(fromId)
  const to = sanitizeId(toId)
  const dir = collectionDir(agentId, basePath, kind)
  if (from === to) {
    return {
      success: true,
      id: to,
      path: itemFilePath(agentId, basePath, kind, to),
    }
  }
  if (kind === 'skills') {
    const src = path.join(dir, from)
    const dest = path.join(dir, to)
    if (await pathExists(dest)) {
      throw new Error(`A skill named "${to}" already exists.`)
    }
    await fs.rename(src, dest)
    return { success: true, id: to, path: path.join(dest, 'SKILL.md') }
  }
  const src = path.join(dir, `${from}.md`)
  const dest = path.join(dir, `${to}.md`)
  if (await pathExists(dest)) {
    throw new Error(`A ${kind} item named "${to}" already exists.`)
  }
  await fs.rename(src, dest)
  return { success: true, id: to, path: dest }
}

/** Copy an item to a new id within the same collection. */
export async function duplicateCollectionItem(
  agentId: string,
  basePath: string,
  kind: CollectionKind,
  id: string,
  newId: string,
): Promise<{ success: boolean; id: string; path: string }> {
  const from = sanitizeId(id)
  const to = sanitizeId(newId)
  const dir = collectionDir(agentId, basePath, kind)
  if (kind === 'skills') {
    const src = path.join(dir, from)
    const dest = path.join(dir, to)
    if (await pathExists(dest)) {
      throw new Error(`A skill named "${to}" already exists.`)
    }
    await fs.cp(src, dest, { recursive: true })
    return { success: true, id: to, path: path.join(dest, 'SKILL.md') }
  }
  const dest = path.join(dir, `${to}.md`)
  if (await pathExists(dest)) {
    throw new Error(`A ${kind} item named "${to}" already exists.`)
  }
  const { content } = await readCollectionItem(agentId, basePath, kind, from)
  await writeTextFileAtomic(dest, content)
  return { success: true, id: to, path: dest }
}

async function collectFiles(dir: string): Promise<string[]> {
  const out: string[] = []
  const entries = await fs.readdir(dir, { withFileTypes: true })
  for (const entry of entries) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) out.push(...(await collectFiles(full)))
    else if (entry.isFile()) out.push(full)
  }
  return out
}

/**
 * Serialize an item for sharing: a single `.md` for commands/agents, or a
 * `.skill` ZIP (folder + support files) for skills — the reverse of import.
 */
export async function exportCollectionItem(
  agentId: string,
  basePath: string,
  kind: CollectionKind,
  id: string,
): Promise<{ fileName: string; data: Buffer }> {
  const safe = sanitizeId(id)
  const collDir = collectionDir(agentId, basePath, kind)
  if (kind === 'skills') {
    const dir = path.join(collDir, safe)
    if (!(await pathExists(dir))) throw new Error(`Skill "${safe}" not found.`)
    const files = await collectFiles(dir)
    const entries = await Promise.all(
      files.map(async (file) => ({
        path: `${safe}/${path.relative(dir, file).split(path.sep).join('/')}`,
        data: await fs.readFile(file),
      })),
    )
    return { fileName: `${safe}.skill`, data: writeZip(entries) }
  }
  const file = path.join(collDir, `${safe}.md`)
  if (!(await pathExists(file))) throw new Error(`${kind} "${safe}" not found.`)
  return {
    fileName: `${safe}.md`,
    data: Buffer.from(await readTextFile(file), 'utf8'),
  }
}
