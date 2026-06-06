/**
 * Recency-paginated session listing shared by every chat runtime.
 *
 * Listing thousands of large JSONL transcripts is the slow path, so instead of
 * fully parsing every file we stat each one (cheap), order by modification time
 * and only parse the requested window. The renderer pulls pages on scroll.
 */

import { promises as fs } from 'node:fs'
import type {
  ChatListOptions,
  ChatSessionMeta,
  ChatSessionPage,
} from '@/shared/types/chat'

/** True when `child` is `parent` or nested below it (OS-separator agnostic). */
export function isUnderDir(child: string, parent: string): boolean {
  const norm = (p: string): string => p.replace(/[/\\]+$/, '')
  const c = norm(child)
  const p = norm(parent)
  return c === p || c.startsWith(`${p}/`) || c.startsWith(`${p}\\`)
}

const byUpdatedDesc = (a: ChatSessionMeta, b: ChatSessionMeta): number =>
  (b.updatedAt ?? '').localeCompare(a.updatedAt ?? '')

/**
 * Stat-sort-parse pagination: orders candidate files by mtime, then parses only
 * the requested slice. Use when files can't be pre-filtered by content.
 */
export async function paginateByMtime<F>(
  files: { filePath: string; ref: F }[],
  opts: ChatListOptions | undefined,
  parse: (ref: F) => Promise<ChatSessionMeta | null>,
): Promise<ChatSessionPage> {
  const offset = Math.max(0, opts?.offset ?? 0)
  const limit = opts?.limit ?? Number.POSITIVE_INFINITY

  const stamped = await Promise.all(
    files.map(async (f) => {
      try {
        const st = await fs.stat(f.filePath)
        return { ref: f.ref, mtime: st.mtimeMs }
      } catch {
        return { ref: f.ref, mtime: 0 }
      }
    }),
  )
  stamped.sort((a, b) => b.mtime - a.mtime)

  const total = stamped.length
  const window = Number.isFinite(limit)
    ? stamped.slice(offset, offset + limit)
    : stamped.slice(offset)
  const metas = await Promise.all(
    window.map((f) => parse(f.ref).catch(() => null)),
  )
  const sessions = metas
    .filter((m): m is ChatSessionMeta => m !== null)
    .sort(byUpdatedDesc)
  return { sessions, total }
}

/**
 * Pagination over already-materialised metas (used when a content filter forces
 * a full parse, e.g. project-scoped listing for agents that don't encode the
 * cwd in the file path).
 */
export function paginateMetas(
  metas: ChatSessionMeta[],
  opts: ChatListOptions | undefined,
): ChatSessionPage {
  const offset = Math.max(0, opts?.offset ?? 0)
  const limit = opts?.limit ?? Number.POSITIVE_INFINITY
  const sorted = [...metas].sort(byUpdatedDesc)
  const total = sorted.length
  const sessions = Number.isFinite(limit)
    ? sorted.slice(offset, offset + limit)
    : sorted.slice(offset)
  return { sessions, total }
}
