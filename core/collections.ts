/**
 * Read / write Claude Code markdown collections: subagents (`agents/*.md`),
 * slash commands (`commands/*.md`) and skills (`skills/<name>/SKILL.md`).
 * Node-only. Item ids are validated to a safe charset (no path traversal).
 */

import path from 'node:path'
import { promises as fs } from 'node:fs'
import type { CollectionItem, CollectionKind } from '@/shared/types/collections'
import { pathExists, readTextFile, writeTextFileAtomic } from './json-file'
import { parseFrontmatter } from './frontmatter'

function sanitizeId(id: string): string {
  const base = path.basename(id).replace(/\.md$/i, '')
  // Parentheses are allowed so imported skill copies (`name(1)`) stay editable.
  if (!/^[A-Za-z0-9._()-]+$/.test(base)) {
    throw new Error(`Invalid collection item id: ${id}`)
  }
  return base
}

function collectionDir(basePath: string, kind: CollectionKind): string {
  return path.join(basePath, kind)
}

function itemFilePath(
  basePath: string,
  kind: CollectionKind,
  id: string,
): string {
  const safe = sanitizeId(id)
  if (kind === 'skills') {
    return path.join(basePath, 'skills', safe, 'SKILL.md')
  }
  return path.join(basePath, kind, `${safe}.md`)
}

export async function listCollection(
  basePath: string,
  kind: CollectionKind,
): Promise<CollectionItem[]> {
  const dir = collectionDir(basePath, kind)
  if (!(await pathExists(dir))) return []

  const entries = await fs.readdir(dir, { withFileTypes: true })
  const items: CollectionItem[] = []

  for (const entry of entries) {
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
  basePath: string,
  kind: CollectionKind,
  id: string,
): Promise<{ content: string; path: string }> {
  const filePath = itemFilePath(basePath, kind, id)
  const content = (await pathExists(filePath))
    ? await readTextFile(filePath)
    : ''
  return { content, path: filePath }
}

export async function writeCollectionItem(
  basePath: string,
  kind: CollectionKind,
  id: string,
  content: string,
): Promise<{ success: boolean; path: string }> {
  const filePath = itemFilePath(basePath, kind, id)
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
  basePath: string,
  fromKind: CollectionKind,
  toKind: CollectionKind,
  id: string,
): Promise<{ success: boolean; id: string; path: string }> {
  if (fromKind === toKind) {
    throw new Error('Source and target collection are the same.')
  }
  const safe = sanitizeId(id)
  const targetPath = itemFilePath(basePath, toKind, safe)
  if (await pathExists(targetPath)) {
    throw new Error(`A ${toKind} item named "${safe}" already exists.`)
  }

  const { content } = await readCollectionItem(basePath, fromKind, safe)
  if (!content.trim()) {
    throw new Error(`The ${fromKind} item "${safe}" has no content to migrate.`)
  }

  await writeCollectionItem(basePath, toKind, safe, content)
  await deleteCollectionItem(basePath, fromKind, safe)
  return { success: true, id: safe, path: targetPath }
}

export async function deleteCollectionItem(
  basePath: string,
  kind: CollectionKind,
  id: string,
): Promise<{ success: boolean }> {
  const safe = sanitizeId(id)
  if (kind === 'skills') {
    // A skill is a folder; remove it (and its references) entirely.
    await fs.rm(path.join(basePath, 'skills', safe), {
      recursive: true,
      force: true,
    })
  } else {
    await fs.rm(path.join(basePath, kind, `${safe}.md`), { force: true })
  }
  return { success: true }
}
