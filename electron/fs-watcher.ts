/**
 * Watches config files for external changes (edits made outside Abyss, or by an
 * agent itself) and pushes a `FileChanged` event to the renderer. Watches the
 * parent directory and filters by basename, so atomic writes (tmp + rename) are
 * still detected. Events are debounced; the renderer decides whether the change
 * is meaningful (it compares the new content to its baseline).
 */

import { watch } from 'node:fs'
import type { FSWatcher } from 'node:fs'
import path from 'node:path'
import { IpcEvent } from '@/shared/types/ipc'
import { invalidateSearchIndex } from '@core/global-search'
import type { Emitter } from './ipc/emit'

let emit: Emitter | null = null
const dirWatchers = new Map<string, FSWatcher>()
const watchedFiles = new Map<string, Set<string>>()
const debounce = new Map<string, NodeJS.Timeout>()

export function configureWatcher(emitter: Emitter): void {
  emit = emitter
}

export function watchFile(filePath: string): void {
  const dir = path.dirname(filePath)
  const base = path.basename(filePath)
  const set = watchedFiles.get(dir) ?? new Set<string>()
  set.add(base)
  watchedFiles.set(dir, set)
  if (dirWatchers.has(dir)) return

  try {
    const watcher = watch(dir, (_event, fileName) => {
      if (!fileName) return
      const name = fileName.toString()
      if (!watchedFiles.get(dir)?.has(name)) return
      const full = path.join(dir, name)
      const prev = debounce.get(full)
      if (prev) clearTimeout(prev)
      debounce.set(
        full,
        setTimeout(() => {
          // A config file changed on disk — drop the memoised global-search
          // index so the next cross-agent search re-reads from disk.
          invalidateSearchIndex()
          emit?.(IpcEvent.FileChanged, { path: full })
        }, 150),
      )
    })
    watcher.on('error', () => undefined)
    dirWatchers.set(dir, watcher)
  } catch {
    // directory may not exist yet — ignore
  }
}

export function unwatchFile(filePath: string): void {
  const dir = path.dirname(filePath)
  const base = path.basename(filePath)
  const set = watchedFiles.get(dir)
  if (!set) return
  set.delete(base)
  if (set.size === 0) {
    watchedFiles.delete(dir)
    dirWatchers.get(dir)?.close()
    dirWatchers.delete(dir)
  }
}

export function unwatchAll(): void {
  for (const watcher of dirWatchers.values()) watcher.close()
  dirWatchers.clear()
  watchedFiles.clear()
}
