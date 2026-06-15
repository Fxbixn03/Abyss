/**
 * Central renderer-side error surfacing. Stores and components funnel caught
 * errors through {@link reportError} so failures become a visible toast instead
 * of a silent rejection, a hanging spinner or a false "saved".
 */

import { toast } from 'sonner'
import { IpcError, IpcErrorCode } from '@/shared/ipc/ipc-error'

/** Best-effort human-readable message for any thrown value. */
export function getErrorMessage(err: unknown): string {
  if (err instanceof Error) return err.message
  if (typeof err === 'string') return err
  return 'Something went wrong.'
}

/**
 * Errors that have already been surfaced (logged + toasted, or explicitly
 * silenced) by an owning caller. The global IPC safety net (see
 * `ipc.client.ts`) consults this so it never double-reports a rejection a
 * store/component already handled. A `WeakSet` keeps it leak-free: entries
 * vanish when the error object is GC'd.
 */
const reportedErrors = new WeakSet<object>()

/** Has this error already been passed through {@link reportError}? */
export function isErrorReported(err: unknown): boolean {
  return typeof err === 'object' && err !== null && reportedErrors.has(err)
}

/** Mark an error as handled so the global IPC net won't re-report it. */
export function markErrorReported(err: unknown): void {
  if (typeof err === 'object' && err !== null) reportedErrors.add(err)
}

/** A config file that failed to parse — callers can route to the raw editor. */
export function isConfigParseError(err: unknown): err is IpcError {
  return err instanceof IpcError && err.code === IpcErrorCode.ConfigParse
}

/** A save was rejected because the content failed JSON/schema validation. */
export function isConfigValidationError(err: unknown): err is IpcError {
  return err instanceof IpcError && err.code === IpcErrorCode.ConfigInvalid
}

/** A renderer-supplied path was rejected because it escaped Abyss's allowed directories. */
export function isPathScopeError(err: unknown): err is IpcError {
  return err instanceof IpcError && err.code === IpcErrorCode.PathScope
}

/** A write was denied by the OS (EACCES or EPERM on the config file). */
export function isWritePermissionError(err: unknown): err is IpcError {
  return err instanceof IpcError && err.code === IpcErrorCode.WritePermission
}

/** A read was denied by the OS (EACCES or EPERM on the config file). */
export function isReadPermissionError(err: unknown): err is IpcError {
  return err instanceof IpcError && err.code === IpcErrorCode.ReadPermission
}

/**
 * Show a targeted 'File is read-only — check permissions' toast for a
 * write-permission error, with an action that reveals the file in the OS file
 * manager. Marks the error as handled so the global IPC net stays quiet.
 *
 * @param err   - The caught error (checked via {@link isWritePermissionError}).
 * @param revealPath - Called with the error's `filePath` when the user clicks
 *                     the action button.  Accepts `undefined` gracefully.
 */
export function reportWritePermissionError(
  err: IpcError,
  revealPath: (path: string) => void,
): void {
  markErrorReported(err)
  const filePath = err.filePath
  toast.error('File is read-only — check permissions', {
    description: filePath,
    action: filePath
      ? {
          label: 'Show in folder',
          onClick: () => revealPath(filePath),
        }
      : undefined,
  })
}

/** A write failed because the disk is full (ENOSPC) or a cross-device rename was attempted (EXDEV). */
export function isDiskWriteError(err: unknown): err is IpcError {
  return err instanceof IpcError && err.code === IpcErrorCode.DiskFull
}

/**
 * Show a targeted 'Disk is full — free up space and try again' toast for a
 * disk-full error, with the affected file path as the description. Marks the
 * error as handled so the global IPC net stays quiet.
 *
 * @param err - The caught error (checked via {@link isDiskWriteError}).
 */
export function reportDiskWriteError(err: IpcError): void {
  markErrorReported(err)
  toast.error('Disk is full — free up space and try again', {
    description: err.filePath,
  })
}

/** Minimal info a store keeps about a corrupt config file, for the repair UI. */
export interface ConfigParseInfo {
  message: string
  filePath?: string
}

export interface ReportErrorOptions {
  /** Short context shown as the toast title, e.g. "Couldn't save MCP servers". */
  title?: string
  /** Skip the toast (caller renders its own UI, e.g. a repair banner). */
  silent?: boolean
}

/**
 * Log an error and (unless silenced) show a toast. Returns the error so callers
 * can `throw reportError(err)` when they still need to propagate it.
 */
export function reportError(
  err: unknown,
  opts: ReportErrorOptions = {},
): unknown {
  console.error(opts.title ?? 'Error', err)
  // Mark first so the global IPC net suppresses its fallback toast — even when
  // `silent` is set, since a silent caller owns the error's presentation.
  markErrorReported(err)
  if (!opts.silent) {
    const message = getErrorMessage(err)
    if (opts.title) toast.error(opts.title, { description: message })
    else toast.error(message)
  }
  return err
}
