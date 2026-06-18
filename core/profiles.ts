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
import {
  profileSchema,
} from '@/shared/schemas/config.schemas'
import { readJsonFile, writeTextFileAtomic } from './json-file'
import { isPermissionError, isDiskError } from './os-errors'
import { ConfigWriteError, ConfigDiskError } from './config-error'

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
  extra?: { description?: string; icon?: string },
): Promise<ProfileMeta> {
  if (!root) throw new Error('Profiles are not configured')
  const meta: ProfileMeta = {
    id: randomUUID(),
    name: name.trim() || 'Untitled profile',
    createdAt: new Date().toISOString(),
    agentIds: bundle.agents.map((a) => a.agentId),
    ...(extra?.description ? { description: extra.description } : {}),
    ...(extra?.icon ? { icon: extra.icon } : {}),
  }
  const profile: Profile = { meta, bundle }
  await writeTextFileAtomic(
    path.join(root, `${meta.id}.json`),
    `${JSON.stringify(profile, null, 2)}\n`,
  )
  return meta
}

/**
 * Read and validate a single profile file. Uses `readJsonFile` so a corrupt
 * JSON file throws a typed {@link ConfigParseError} (carrying `filePath`)
 * rather than being silently dropped. Valid JSON is then run through the
 * lenient `profileSchema` which coerces bad shapes into an empty-id object;
 * those are rejected by the `meta.id` guard below. Returns `null` only when
 * the file is absent or structurally valid but missing required fields.
 */
async function readProfileFile(file: string): Promise<Profile | null> {
  // readJsonFile throws ConfigParseError on bad JSON — let that propagate.
  const raw = await readJsonFile<unknown>(file, null)
  if (raw === null) return null

  // Validate the parsed shape; the schema never throws (outer .catch) but
  // populates empty strings for required fields when the shape is wrong.
  const stored = profileSchema.parse(raw)
  // Treat an empty meta.id (the catch sentinel) as a structurally invalid file.
  if (!stored.meta?.id) return null
  return stored as unknown as Profile
}

export async function listProfiles(): Promise<ProfileMeta[]> {
  if (!root) return []
  const entries = await fs.readdir(root).catch(() => [] as string[])
  const metas: ProfileMeta[] = []
  for (const entry of entries) {
    if (!entry.endsWith('.json')) continue
    // Let ConfigParseError propagate — the IPC handle wrapper encodes it as a
    // structured IpcError with code CONFIG_PARSE_ERROR so the renderer can
    // surface the repair flow instead of receiving a silently shortened list.
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
  try {
    await writeTextFileAtomic(file, `${JSON.stringify(profile, null, 2)}\n`)
  } catch (err) {
    if (isPermissionError(err)) throw new ConfigWriteError(file, err)
    if (isDiskError(err)) throw new ConfigDiskError(file, err)
    throw err
  }
  return profile.meta
}
