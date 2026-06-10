/**
 * Read / write Claude Code's `settings.json` — permissions, model and env.
 * Node-only. Unknown keys in the file are preserved on write.
 */

import path from 'node:path'
import type {
  ModelEnvConfig,
  PermissionMode,
  PermissionRules,
} from '@/shared/types/config'
import { readJsonFile, writeJsonFile } from './json-file'

interface ClaudeSettingsFile {
  permissions?: {
    allow?: string[]
    deny?: string[]
    ask?: string[]
    defaultMode?: string
    additionalDirectories?: string[]
    [key: string]: unknown
  }
  model?: string
  env?: Record<string, string>
  [key: string]: unknown
}

function settingsPath(basePath: string): string {
  return path.join(basePath, 'settings.json')
}

export async function readPermissions(
  basePath: string,
): Promise<PermissionRules> {
  const s = await readJsonFile<ClaudeSettingsFile>(settingsPath(basePath), {})
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
  const s = await readJsonFile<ClaudeSettingsFile>(p, {})
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
  const s = await readJsonFile<ClaudeSettingsFile>(settingsPath(basePath), {})
  return { model: s.model, env: s.env ?? {} }
}

export async function writeModelEnv(
  basePath: string,
  config: ModelEnvConfig,
): Promise<{ success: boolean; path: string }> {
  const p = settingsPath(basePath)
  const s = await readJsonFile<ClaudeSettingsFile>(p, {})
  if (config.model && config.model.trim() !== '') {
    s.model = config.model
  } else {
    delete s.model
  }
  s.env = config.env
  await writeJsonFile(p, s)
  return { success: true, path: p }
}
