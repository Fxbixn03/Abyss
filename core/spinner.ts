/**
 * Read / write Claude Code's spinner customization in `settings.json`, in place
 * and preserving every other key. Two keys are managed: `spinnerVerbs`
 * (`{ mode, verbs }`) and `spinnerTipsOverride` (`{ tips, excludeDefault }`).
 * Empty verb / tip lists remove their key entirely so settings stay clean.
 * Node-only. See https://code.claude.com/docs/en/settings
 */

import path from 'node:path'
import {
  DEFAULT_SPINNER,
  type SpinnerConfig,
  type SpinnerVerbsMode,
} from '@/shared/types/spinner'
import { readJsonFile, writeJsonFile } from './json-file'

interface SettingsWithSpinner {
  spinnerVerbs?: { mode?: string; verbs?: unknown }
  spinnerTipsOverride?: { tips?: unknown; excludeDefault?: unknown }
  [key: string]: unknown
}

function settingsPath(basePath: string): string {
  return path.join(basePath, 'settings.json')
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((v): v is string => typeof v === 'string')
    : []
}

export async function readSpinner(basePath: string): Promise<SpinnerConfig> {
  const s = await readJsonFile<SettingsWithSpinner>(settingsPath(basePath), {})

  const verbs = s.spinnerVerbs
  const tips = s.spinnerTipsOverride
  if (verbs === undefined && tips === undefined) return { ...DEFAULT_SPINNER }

  return {
    verbsConfigured: verbs !== undefined,
    verbsMode: (verbs?.mode === 'replace'
      ? 'replace'
      : 'append') as SpinnerVerbsMode,
    verbs: asStringArray(verbs?.verbs),
    tipsConfigured: tips !== undefined,
    tips: asStringArray(tips?.tips),
    tipsExcludeDefault: tips?.excludeDefault === true,
  }
}

export async function writeSpinner(
  basePath: string,
  cfg: SpinnerConfig,
): Promise<{ success: boolean; path: string }> {
  const p = settingsPath(basePath)
  const s = await readJsonFile<SettingsWithSpinner>(p, {})

  const verbs = cfg.verbs.map((v) => v.trim()).filter(Boolean)
  if (verbs.length > 0) {
    s.spinnerVerbs = { mode: cfg.verbsMode, verbs }
  } else {
    delete s.spinnerVerbs
  }

  const tips = cfg.tips.map((t) => t.trim()).filter(Boolean)
  if (tips.length > 0) {
    s.spinnerTipsOverride = {
      tips,
      ...(cfg.tipsExcludeDefault ? { excludeDefault: true } : {}),
    }
  } else {
    delete s.spinnerTipsOverride
  }

  await writeJsonFile(p, s)
  return { success: true, path: p }
}
