/**
 * Persisted application settings (Abyss's own store, kept in userData). The
 * file path is injected so the main process and tests can point it anywhere.
 * Node-only.
 */

import { DEFAULT_APP_SETTINGS } from '@/shared/types/config'
import type { AppSettings } from '@/shared/types/config'
import {
  appSettingsSchema,
  type StoredAppSettings,
} from '@/shared/schemas/config.schemas'
import { readJsonFile, writeJsonFile } from './json-file'

export class SettingsStore {
  constructor(private readonly filePath: string) {}

  async read(): Promise<AppSettings> {
    // The schema is lenient (per-field `.catch`), so a partly-corrupt settings
    // file degrades to defaults field-by-field instead of being rejected.
    const stored = await readJsonFile<StoredAppSettings>(
      this.filePath,
      {},
      appSettingsSchema,
    )
    // Drop dropped/undefined fields so they never clobber a default.
    const defined = Object.fromEntries(
      Object.entries(stored).filter(([, v]) => v !== undefined),
    ) as Partial<AppSettings>
    return {
      ...DEFAULT_APP_SETTINGS,
      ...defined,
      agentPaths: {
        ...DEFAULT_APP_SETTINGS.agentPaths,
        ...(stored.agentPaths ?? {}),
      },
    }
  }

  async update(patch: Partial<AppSettings>): Promise<AppSettings> {
    const current = await this.read()
    const next: AppSettings = {
      ...current,
      ...patch,
      agentPaths: { ...current.agentPaths, ...(patch.agentPaths ?? {}) },
    }
    await writeJsonFile(this.filePath, next)
    return next
  }
}
