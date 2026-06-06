/**
 * Named config-set storage ("profiles"). Each profile is a saved ExportBundle
 * persisted under Abyss's data dir; applying one reuses the bundle apply path
 * (and therefore the snapshot safety net). Node-only.
 */

import path from 'node:path'
import { promises as fs } from 'node:fs'
import { randomUUID } from 'node:crypto'
import type { ExportBundle } from '@/shared/types/bundle'
import type { Profile, ProfileMeta } from '@/shared/types/profiles'

let root: string | null = null

export function configureProfiles(dir: string): void {
  root = dir
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function fileFor(id: string): string | null {
  if (!root || !UUID.test(id)) return null
  return path.join(root, `${id}.json`)
}

export async function saveProfile(
  name: string,
  bundle: ExportBundle,
): Promise<ProfileMeta> {
  if (!root) throw new Error('Profiles are not configured')
  const meta: ProfileMeta = {
    id: randomUUID(),
    name: name.trim() || 'Untitled profile',
    createdAt: new Date().toISOString(),
    agentIds: bundle.agents.map((a) => a.agentId),
  }
  await fs.mkdir(root, { recursive: true })
  const profile: Profile = { meta, bundle }
  await fs.writeFile(
    path.join(root, `${meta.id}.json`),
    `${JSON.stringify(profile, null, 2)}\n`,
    'utf8',
  )
  return meta
}

async function readProfileFile(file: string): Promise<Profile | null> {
  try {
    const parsed = JSON.parse(await fs.readFile(file, 'utf8')) as Profile
    if (!parsed?.meta?.id || !parsed.bundle) return null
    return parsed
  } catch {
    return null
  }
}

export async function listProfiles(): Promise<ProfileMeta[]> {
  if (!root) return []
  const entries = await fs.readdir(root).catch(() => [] as string[])
  const metas: ProfileMeta[] = []
  for (const entry of entries) {
    if (!entry.endsWith('.json')) continue
    const profile = await readProfileFile(path.join(root, entry))
    if (profile) metas.push(profile.meta)
  }
  return metas.sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}

export async function readProfile(id: string): Promise<Profile | null> {
  const file = fileFor(id)
  if (!file) return null
  return readProfileFile(file)
}

export async function deleteProfile(id: string): Promise<boolean> {
  const file = fileFor(id)
  if (!file) return false
  await fs.rm(file, { force: true })
  return true
}

export async function renameProfile(
  id: string,
  name: string,
): Promise<ProfileMeta | null> {
  const file = fileFor(id)
  if (!file) return null
  const profile = await readProfileFile(file)
  if (!profile) return null
  profile.meta.name = name.trim() || profile.meta.name
  await fs.writeFile(file, `${JSON.stringify(profile, null, 2)}\n`, 'utf8')
  return profile.meta
}
