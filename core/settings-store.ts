/**
 * Persisted application settings (Abyss's own store, kept in userData). The
 * file path is injected so the main process and tests can point it anywhere.
 * Node-only.
 */

import { DEFAULT_APP_SETTINGS } from '@/shared/types/config'
import type { AppSettings } from '@/shared/types/config'
import { readJsonFile, writeJsonFile } from './json-file'

export class SettingsStore {
  constructor(private readonly filePath: string) {}

  async read(): Promise<AppSettings> {
    const stored = await readJsonFile<Partial<AppSettings>>(this.filePath, {})
    return {
      ...DEFAULT_APP_SETTINGS,
      ...stored,
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
