/**
 * Read / write markdown collections shared by AI agents: subagents
 * (`agents/*.md`), slash commands (`commands/*.md`), skills
 * (`skills/<…>/SKILL.md`) and Cursor's always-on rules (`rules/*.mdc`).
 * Node-only. Item ids are validated to a safe charset (no path traversal).
 *
 * Skills may be nested under organisational category folders (Cursor allows
 * `skills/<category>/<name>/SKILL.md`); their id is the POSIX-relative path from
 * the `skills/` directory to the folder holding `SKILL.md`. Flat skills keep a
 * bare folder-name id, so this stays backwards compatible.
 */

import path from 'node:path'
import { promises as fs } from 'node:fs'
import type {
  CollectionItem,
  CollectionKind,
  SkillFile,
} from '@/shared/types/collections'
import { collectionDirName } from '@/shared/agents/defs'
import {
  ensureDir,
  pathExists,
  readTextFile,
  writeTextFileAtomic,
} from './json-file'
import { parseFrontmatter } from './frontmatter'
import { writeZip } from './zip'

const SEGMENT_RE = /^[A-Za-z0-9._()-]+$/

/** On-disk file extension for a kind's items (skills are folders, not files). */
function collectionExt(kind: CollectionKind): string {
  return kind === 'rules' ? '.mdc' : '.md'
}

/**
 * Validate and normalise an item id. Skills may carry a nested POSIX path
 * (`category/name`); every other kind is a single safe basename with its
 * extension stripped.
 */
function sanitizeId(id: string, kind: CollectionKind): string {
  if (kind === 'skills') {
    const segments = id.split(/[\\/]+/).filter(Boolean)
    if (segments.length === 0) throw new Error(`Invalid skill id: ${id}`)
    for (const seg of segments) {
      if (seg === '.' || seg === '..' || !SEGMENT_RE.test(seg)) {
        throw new Error(`Invalid skill id: ${id}`)
      }
    }
    return segments.join('/')
  }
  const ext = collectionExt(kind)
  let base = path.basename(id)
  if (base.toLowerCase().endsWith(ext)) base = base.slice(0, -ext.length)
  // Parentheses are allowed so imported copies (`name(1)`) stay editable.
  if (!SEGMENT_RE.test(base)) {
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

/** Absolute folder of a (possibly nested) skill from its sanitized POSIX id. */
function skillFolderPath(skillsDir: string, safeId: string): string {
  return path.join(skillsDir, ...safeId.split('/'))
}

function itemFilePath(
  agentId: string,
  basePath: string,
  kind: CollectionKind,
  id: string,
): string {
  const safe = sanitizeId(id, kind)
  if (kind === 'skills') {
    return path.join(
      skillFolderPath(collectionDir(agentId, basePath, 'skills'), safe),
      'SKILL.md',
    )
  }
  return path.join(
    collectionDir(agentId, basePath, kind),
    `${safe}${collectionExt(kind)}`,
  )
}

function summarize(
  id: string,
  filePath: string,
  content: string,
): CollectionItem {
  const { data } = parseFrontmatter(content)
  return {
    id,
    name: data.name || path.basename(id),
    description: data.description || '',
    model: data.model,
    tools: data.tools,
    argumentHint: data['argument-hint'],
    globs: data.globs,
    alwaysApply:
      data.alwaysApply === undefined ? undefined : data.alwaysApply === 'true',
    path: filePath,
  }
}

/**
 * Recursively find every skill (a folder directly containing `SKILL.md`) under
 * `skillsDir`. Stops descending once a skill is found, so a skill's own
 * `scripts/` / `references/` subfolders aren't mistaken for nested skills.
 */
async function listSkills(skillsDir: string): Promise<CollectionItem[]> {
  const out: CollectionItem[] = []

  async function walk(current: string): Promise<void> {
    const skillFile = path.join(current, 'SKILL.md')
    if (current !== skillsDir && (await pathExists(skillFile))) {
      const id = path.relative(skillsDir, current).split(path.sep).join('/')
      const item = summarize(id, skillFile, await readTextFile(skillFile))
      item.mtime = (await fs.stat(skillFile)).mtimeMs
      out.push(item)
      return
    }
    const entries = await fs.readdir(current, { withFileTypes: true })
    for (const entry of entries) {
      // Skip dotfiles/dirs — e.g. Codex's managed `skills/.system` bundle.
      if (entry.name.startsWith('.') || !entry.isDirectory()) continue
      await walk(path.join(current, entry.name))
    }
  }

  await walk(skillsDir)
  return out
}

export async function listCollection(
  agentId: string,
  basePath: string,
  kind: CollectionKind,
): Promise<CollectionItem[]> {
  const dir = collectionDir(agentId, basePath, kind)
  if (!(await pathExists(dir))) return []

  let items: CollectionItem[]
  if (kind === 'skills') {
    items = await listSkills(dir)
  } else {
    const ext = collectionExt(kind)
    const entries = await fs.readdir(dir, { withFileTypes: true })
    items = []
    for (const entry of entries) {
      if (entry.name.startsWith('.')) continue
      if (!entry.isFile() || !entry.name.toLowerCase().endsWith(ext)) continue
      const id = entry.name.slice(0, -ext.length)
      const filePath = path.join(dir, entry.name)
      const item = summarize(id, filePath, await readTextFile(filePath))
      item.mtime = (await fs.stat(filePath)).mtimeMs
      items.push(item)
    }
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
  const safeFrom = sanitizeId(id, fromKind)
  const safeTo = sanitizeId(id, toKind)
  const targetPath = itemFilePath(agentId, basePath, toKind, safeTo)
  if (await pathExists(targetPath)) {
    throw new Error(`A ${toKind} item named "${safeTo}" already exists.`)
  }

  const { content } = await readCollectionItem(
    agentId,
    basePath,
    fromKind,
    safeFrom,
  )
  if (!content.trim()) {
    throw new Error(
      `The ${fromKind} item "${safeFrom}" has no content to migrate.`,
    )
  }

  await writeCollectionItem(agentId, basePath, toKind, safeTo, content)
  await deleteCollectionItem(agentId, basePath, fromKind, safeFrom)
  return { success: true, id: safeTo, path: targetPath }
}

export async function deleteCollectionItem(
  agentId: string,
  basePath: string,
  kind: CollectionKind,
  id: string,
): Promise<{ success: boolean }> {
  const safe = sanitizeId(id, kind)
  const dir = collectionDir(agentId, basePath, kind)
  if (kind === 'skills') {
    // A skill is a folder; remove it (and its references) entirely.
    await fs.rm(skillFolderPath(dir, safe), { recursive: true, force: true })
  } else {
    await fs.rm(path.join(dir, `${safe}${collectionExt(kind)}`), {
      force: true,
    })
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
  const from = sanitizeId(fromId, kind)
  const to = sanitizeId(toId, kind)
  const dir = collectionDir(agentId, basePath, kind)
  if (from === to) {
    return {
      success: true,
      id: to,
      path: itemFilePath(agentId, basePath, kind, to),
    }
  }
  if (kind === 'skills') {
    const src = skillFolderPath(dir, from)
    const dest = skillFolderPath(dir, to)
    if (await pathExists(dest)) {
      throw new Error(`A skill named "${to}" already exists.`)
    }
    await ensureDir(path.dirname(dest))
    await fs.rename(src, dest)
    return { success: true, id: to, path: path.join(dest, 'SKILL.md') }
  }
  const ext = collectionExt(kind)
  const src = path.join(dir, `${from}${ext}`)
  const dest = path.join(dir, `${to}${ext}`)
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
  const from = sanitizeId(id, kind)
  const to = sanitizeId(newId, kind)
  const dir = collectionDir(agentId, basePath, kind)
  if (kind === 'skills') {
    const src = skillFolderPath(dir, from)
    const dest = skillFolderPath(dir, to)
    if (await pathExists(dest)) {
      throw new Error(`A skill named "${to}" already exists.`)
    }
    await ensureDir(path.dirname(dest))
    await fs.cp(src, dest, { recursive: true })
    return { success: true, id: to, path: path.join(dest, 'SKILL.md') }
  }
  const ext = collectionExt(kind)
  const dest = path.join(dir, `${to}${ext}`)
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
 * Serialize an item for sharing: a single file for commands/agents/rules, or a
 * `.skill` ZIP (folder + support files) for skills — the reverse of import.
 */
export async function exportCollectionItem(
  agentId: string,
  basePath: string,
  kind: CollectionKind,
  id: string,
): Promise<{ fileName: string; data: Buffer }> {
  const safe = sanitizeId(id, kind)
  const collDir = collectionDir(agentId, basePath, kind)
  if (kind === 'skills') {
    const dir = skillFolderPath(collDir, safe)
    if (!(await pathExists(dir))) throw new Error(`Skill "${safe}" not found.`)
    const leaf = safe.split('/').pop() ?? safe
    const files = await collectFiles(dir)
    const entries = await Promise.all(
      files.map(async (file) => ({
        path: `${leaf}/${path.relative(dir, file).split(path.sep).join('/')}`,
        data: await fs.readFile(file),
      })),
    )
    return { fileName: `${leaf}.skill`, data: writeZip(entries) }
  }
  const ext = collectionExt(kind)
  const file = path.join(collDir, `${safe}${ext}`)
  if (!(await pathExists(file))) throw new Error(`${kind} "${safe}" not found.`)
  return {
    fileName: `${safe}${ext}`,
    data: Buffer.from(await readTextFile(file), 'utf8'),
  }
}

/**
 * The bundled files inside a skill folder (everything but the SKILL.md entry),
 * for the skill editor's file browser. Sorted by relative path.
 */
export async function listSkillFiles(
  agentId: string,
  basePath: string,
  id: string,
): Promise<SkillFile[]> {
  const safe = sanitizeId(id, 'skills')
  const dir = skillFolderPath(collectionDir(agentId, basePath, 'skills'), safe)
  if (!(await pathExists(dir))) return []
  const out: SkillFile[] = []
  for (const file of await collectFiles(dir)) {
    const relPath = path.relative(dir, file).split(path.sep).join('/')
    if (relPath.toLowerCase() === 'skill.md') continue
    out.push({ relPath, path: file, size: (await fs.stat(file)).size })
  }
  out.sort((a, b) => a.relPath.localeCompare(b.relPath))
  return out
}
