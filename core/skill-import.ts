/**
 * Import a Claude "skill" archive (`*.skill`, a ZIP) downloaded from the web app
 * into an agent's `skills/` directory. The archive holds a single top-level
 * folder named after the skill, containing `SKILL.md` plus any support files:
 *
 *   humanizer.skill  ->  humanizer/SKILL.md (+ scripts, references, …)
 *
 * Node-only. Reuses the dependency-free {@link readZip} reader. Guards against
 * path traversal ("zip slip") so a crafted archive can't escape `skills/`.
 */

import path from 'node:path'
import { promises as fs } from 'node:fs'
import type {
  SkillCollisionMode,
  SkillImportResult,
} from '@/shared/types/collections'
import { readZip } from './zip'
import { parseFrontmatter } from './frontmatter'
import { pathExists } from './json-file'

/** Allowed characters for a skill folder name (and therefore its id). */
const SAFE_ID = /^[A-Za-z0-9._()-]+$/

/** Find the next free `name(1)`, `name(2)`, … under `skills/`. */
async function nextFreeId(skillsDir: string, baseId: string): Promise<string> {
  for (let n = 1; ; n++) {
    const candidate = `${baseId}(${n})`
    if (!(await pathExists(path.join(skillsDir, candidate)))) return candidate
  }
}

export async function importSkillArchive(
  basePath: string,
  archivePath: string,
  onCollision: SkillCollisionMode,
): Promise<SkillImportResult> {
  const entries = readZip(await fs.readFile(archivePath))

  // The skill folder name is the first path segment of the `<name>/SKILL.md`.
  const skillMd = entries.find((e) => /^[^/]+\/SKILL\.md$/i.test(e.path))
  if (!skillMd) {
    throw new Error(
      'Not a valid skill archive: expected a single folder containing SKILL.md.',
    )
  }
  const baseId = skillMd.path.split('/')[0]
  if (!SAFE_ID.test(baseId)) {
    throw new Error(`Invalid skill folder name: "${baseId}".`)
  }

  const skillsDir = path.join(basePath, 'skills')
  const exists = await pathExists(path.join(skillsDir, baseId))

  if (exists && onCollision === 'fail') {
    return {
      status: 'collision',
      existingId: baseId,
      suggestedId: await nextFreeId(skillsDir, baseId),
    }
  }

  const targetId = exists ? await nextFreeId(skillsDir, baseId) : baseId
  const destDir = path.join(skillsDir, targetId)
  const resolvedDest = path.resolve(destDir)
  const sourcePrefix = `${baseId}/`

  for (const entry of entries) {
    // Only files under the skill folder; ignore stray top-level junk.
    if (!entry.path.startsWith(sourcePrefix)) continue
    const rel = entry.path.slice(sourcePrefix.length)
    if (rel === '') continue

    const segments = rel.split('/').filter((s) => s !== '')
    if (segments.some((s) => s === '.' || s === '..')) {
      throw new Error(`Unsafe path in archive: "${entry.path}".`)
    }
    const target = path.join(destDir, ...segments)
    // Belt-and-suspenders: the resolved path must stay inside destDir.
    if (
      path.resolve(target) !== resolvedDest &&
      !path.resolve(target).startsWith(resolvedDest + path.sep)
    ) {
      throw new Error(`Unsafe path in archive: "${entry.path}".`)
    }

    if (entry.isDirectory) {
      await fs.mkdir(target, { recursive: true })
    } else {
      await fs.mkdir(path.dirname(target), { recursive: true })
      await fs.writeFile(target, entry.data)
    }
  }

  const skillMdPath = path.join(destDir, 'SKILL.md')
  const { data } = parseFrontmatter(await fs.readFile(skillMdPath, 'utf8'))
  return {
    status: 'imported',
    id: targetId,
    name: data.name || targetId,
    path: skillMdPath,
  }
}
