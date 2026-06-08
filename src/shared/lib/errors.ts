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

/** A config file that failed to parse — callers can route to the raw editor. */
export function isConfigParseError(err: unknown): err is IpcError {
  return err instanceof IpcError && err.code === IpcErrorCode.ConfigParse
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
export function reportError(err: unknown, opts: ReportErrorOptions = {}): unknown {
  console.error(opts.title ?? 'Error', err)
  if (!opts.silent) {
    const message = getErrorMessage(err)
    if (opts.title) toast.error(opts.title, { description: message })
    else toast.error(message)
  }
  return err
}
