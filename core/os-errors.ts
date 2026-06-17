/**
 * Shared OS-level error predicates. Node-only; imported by all core modules
 * that wrap `fs` calls in typed config errors.
 */

/** Returns true when a Node.js filesystem error is a permission denial. */
export function isPermissionError(err: unknown): boolean {
  if (err && typeof err === 'object' && 'code' in err) {
    const code = (err as { code: unknown }).code
    return code === 'EACCES' || code === 'EPERM'
  }
  return false
}

/** Returns true when a Node.js filesystem error is a disk-space or cross-device issue. */
export function isDiskError(err: unknown): boolean {
  if (err && typeof err === 'object' && 'code' in err) {
    const code = (err as { code: unknown }).code
    return code === 'ENOSPC' || code === 'EXDEV'
  }
  return false
}

/** Returns true when a Node.js filesystem error indicates the path does not exist. */
export function isNotFoundOsError(err: unknown): boolean {
  if (err && typeof err === 'object' && 'code' in err) {
    const code = (err as { code: unknown }).code
    return code === 'ENOENT'
  }
  return false
}
