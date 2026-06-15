/**
 * Read / write Claude Code's `settings.json` — permissions, model and env.
 * Node-only. Unknown keys in the file are preserved on write.
 */

import path from 'node:path'
import { z } from 'zod'
import type {
  ModelEnvConfig,
  PermissionMode,
  PermissionRules,
} from '@/shared/types/config'
import { readJsonFile, writeJsonFile } from './json-file'

/**
 * Lenient schema for Claude's `settings.json`. The top-level object is
 * passthrough (unknown keys survive the read → write round-trip). The
 * `permissions` sub-object is validated strictly enough to catch shape errors
 * (e.g. `allow` containing non-strings or being a non-array) while still
 * allowing unknown sibling keys via passthrough. A completely missing or empty
 * file never reaches the schema (handled by the `readJsonFile` fallback path).
 */
const claudeSettingsSchema = z
  .object({
    permissions: z
      .object({
        allow: z.array(z.string()).optional(),
        deny: z.array(z.string()).optional(),
        ask: z.array(z.string()).optional(),
        defaultMode: z.string().optional(),
        additionalDirectories: z.array(z.string()).optional(),
      })
      .passthrough()
      .optional(),
    model: z.string().optional(),
    env: z.record(z.string(), z.string()).optional(),
  })
  .passthrough()

function settingsPath(basePath: string): string {
  return path.join(basePath, 'settings.json')
}

export async function readPermissions(
  basePath: string,
): Promise<PermissionRules> {
  const s = await readJsonFile(settingsPath(basePath), {}, claudeSettingsSchema)
  return {
    allow: s.permissions?.allow ?? [],
    deny: s.permissions?.deny ?? [],
    ask: s.permissions?.ask ?? [],
    defaultMode: (s.permissions?.defaultMode as PermissionMode) ?? 'default',
    additionalDirectories: s.permissions?.additionalDirectories ?? [],
  }
}

export async function writePermissions(
  basePath: string,
  rules: PermissionRules,
): Promise<{ success: boolean; path: string }> {
  const p = settingsPath(basePath)
  const s = await readJsonFile(p, {}, claudeSettingsSchema)
  // Merge over the existing block so unknown keys under `permissions` survive.
  const perms = { ...s.permissions }
  perms.allow = rules.allow
  perms.deny = rules.deny
  perms.ask = rules.ask

  if (rules.defaultMode && rules.defaultMode !== 'default') {
    perms.defaultMode = rules.defaultMode
  } else {
    delete perms.defaultMode
  }

  if (rules.additionalDirectories && rules.additionalDirectories.length > 0) {
    perms.additionalDirectories = rules.additionalDirectories
  } else {
    delete perms.additionalDirectories
  }

  s.permissions = perms
  await writeJsonFile(p, s)
  return { success: true, path: p }
}

export async function readModelEnv(basePath: string): Promise<ModelEnvConfig> {
  const s = await readJsonFile(settingsPath(basePath), {}, claudeSettingsSchema)
  return { model: s.model, env: s.env ?? {} }
}

export async function writeModelEnv(
  basePath: string,
  config: ModelEnvConfig,
): Promise<{ success: boolean; path: string }> {
  const p = settingsPath(basePath)
  const s = await readJsonFile(p, {}, claudeSettingsSchema)
  if (config.model && config.model.trim() !== '') {
    s.model = config.model
  } else {
    delete s.model
  }
  s.env = config.env
  await writeJsonFile(p, s)
  return { success: true, path: p }
}
