/**
 * Path-scoping helpers — a defense-in-depth layer between renderer-supplied
 * paths and the filesystem. Node-only.
 *
 * The renderer hands the main process absolute paths (config files to watch,
 * directories to create, a sandbox cwd). The renderer is trusted, but the IPC
 * surface is the natural boundary to harden: these helpers reject obviously
 * malformed paths (empty / NUL bytes) and, where a set of allowed roots is
 * known, confine a path to within those roots so a `../`-traversal can't escape.
 *
 * Allowed roots are deliberately broad — the user's home directory (where every
 * agent keeps its config), the OS app-data root, and Abyss's own userData. A
 * tighter per-agent allowlist would break legitimate use: agents add and rename
 * config files, users point overrides at arbitrary directories under home, and
 * snapshots/profiles live under userData. Broad-but-bounded is the right
 * trade-off here.
 */

import path from 'node:path'
import type { OsEnv } from '@/shared/types/agent'

/** A path is unusable if it's empty or carries a NUL byte (path-injection). */
export function isWellFormedPath(p: string): boolean {
  return typeof p === 'string' && p.length > 0 && !p.includes('\0')
}

/**
 * The set of filesystem roots Abyss is allowed to touch on the user's behalf:
 * the home directory, the OS app-data root and Abyss's own userData dir. Roots
 * are resolved + de-duplicated; empty ones are dropped.
 */
export function allowedRoots(env: OsEnv, userData: string): string[] {
  const roots = [env.home, env.appData, userData]
    .filter((r) => isWellFormedPath(r))
    .map((r) => path.resolve(r))
  return [...new Set(roots)]
}

/**
 * True when `target` resolves to a location inside `root` (or is `root`
 * itself). Compares normalised, resolved paths and guards the boundary with a
 * trailing separator so `/home/user-evil` is not treated as inside `/home/user`.
 */
export function isInsideRoot(target: string, root: string): boolean {
  const resolvedRoot = path.resolve(root)
  const resolvedTarget = path.resolve(target)
  if (resolvedTarget === resolvedRoot) return true
  const withSep = resolvedRoot.endsWith(path.sep)
    ? resolvedRoot
    : resolvedRoot + path.sep
  return resolvedTarget.startsWith(withSep)
}

/**
 * Validate a renderer-supplied path against the allowed roots. Returns the
 * resolved, normalised path when it is well-formed and contained; otherwise
 * `null`. Callers decide how to react to `null` (skip the op, return an error).
 */
export function resolveScopedPath(
  target: string,
  env: OsEnv,
  userData: string,
): string | null {
  if (!isWellFormedPath(target)) return null
  const resolved = path.resolve(target)
  const roots = allowedRoots(env, userData)
  // If no roots are known (shouldn't happen in practice), fall back to the
  // well-formedness check only rather than rejecting everything.
  if (roots.length === 0) return resolved
  return roots.some((root) => isInsideRoot(resolved, root)) ? resolved : null
}

/** Stable code so the renderer can branch on / surface a scoped-path rejection. */
export const PATH_SCOPE_ERROR_CODE = 'PATH_OUT_OF_SCOPE'

/**
 * Thrown by {@link assertScopedPath} when a renderer-supplied path escapes the
 * allowed roots. Carries `code` + `filePath` so the IPC error encoder ferries
 * structured info to the renderer (see `ipc-error.ts`).
 */
export class PathScopeError extends Error {
  readonly code = PATH_SCOPE_ERROR_CODE
  readonly filePath: string
  constructor(target: string) {
    super(`Path is outside Abyss's allowed directories: ${target}`)
    this.name = 'PathScopeError'
    this.filePath = target
  }
}

/**
 * Like {@link resolveScopedPath}, but throws a {@link PathScopeError} (instead
 * of returning `null`) for write/mutating handlers that should fail loudly
 * rather than silently skip. Returns the resolved, in-scope path.
 */
export function assertScopedPath(
  target: string,
  env: OsEnv,
  userData: string,
): string {
  const safe = resolveScopedPath(target, env, userData)
  if (!safe) throw new PathScopeError(target)
  return safe
}
